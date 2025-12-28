import express from 'express';
import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// --- CLASSIFICATION LOGIC ---
const classifyTask = (title: string, description: string) => {
  const content = (title + " " + description).toLowerCase();
  
  let category = 'general';
  if (/meeting|schedule|call|appointment|deadline/.test(content)) category = 'scheduling';
  else if (/payment|invoice|bill|budget|cost|expense/.test(content)) category = 'finance';
  else if (/bug|fix|error|install|repair|maintain/.test(content)) category = 'technical';
  else if (/safety|hazard|inspection|compliance|ppe/.test(content)) category = 'safety';

  let priority = 'low';
  if (/urgent|asap|immediately|today|critical|emergency/.test(content)) priority = 'high';
  else if (/soon|important|week/.test(content)) priority = 'medium';

  const actionsMap: Record<string, string[]> = {
    scheduling: ["Block calendar", "Send invite", "Prepare agenda", "Set reminder"],
    finance: ["Check budget", "Get approval", "Generate invoice", "Update records"],
    technical: ["Diagnose issue", "Check resources", "Assign technician", "Document fix"],
    safety: ["Conduct inspection", "File report", "Notify supervisor", "Update checklist"],
    general: ["Review task", "Set reminder"]
  };

  const entities = {
    dates: content.match(/\d{4}-\d{2}-\d{2}/g) || [],
    people: content.match(/(?:with|by|assign to)\s+([A-Z][a-z]+)/g)?.map(s => s.split(' ').pop()) || []
  };

  return { category, priority, suggested_actions: actionsMap[category], extracted_entities: entities };
};

// --- API ENDPOINTS ---

// 1. Create Task (With Preview Support)
app.post('/api/tasks', async (req: Request, res: Response) => {
  try {
    const { title, description, assigned_to, due_date, override_category, override_priority } = req.body;
    const smartData = classifyTask(title, description);

    const taskData = {
      title,
      description,
      assigned_to,
      due_date,
      category: override_category || smartData.category,
      priority: override_priority || smartData.priority,
      suggested_actions: smartData.suggested_actions,
      extracted_entities: smartData.extracted_entities,
      status: 'pending'
    };

    const { data, error } = await supabase.from('tasks').insert([taskData]).select();
    if (error) throw error;

    // Record History
    await supabase.from('task_history').insert([{
      task_id: data[0].id,
      action: 'created',
      new_value: taskData
    }]);

    res.status(201).json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 2. List Tasks (With Pagination & Filters)
app.get('/api/tasks', async (req: Request, res: Response) => {
  const { status, category, priority, search, limit = 10, offset = 0 } = req.query;
  let query = supabase.from('tasks').select('*', { count: 'exact' });

  if (status) query = query.eq('status', status as string);
  if (category) query = query.eq('category', category as string);
  if (priority) query = query.eq('priority', priority as string);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, count, error } = await query
    .range(Number(offset), Number(offset) + Number(limit) - 1)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ data, total: count });
});

// 3. Get Task Details with History
app.get('/api/tasks/:id', async (req: Request, res: Response) => {
  const { data: task } = await supabase.from('tasks').select('*').eq('id', req.params.id).single();
  const { data: history } = await supabase.from('task_history').select('*').eq('task_id', req.params.id).order('changed_at', { ascending: false });
  res.json({ ...task, history });
});

// 4. Update Task
app.patch('/api/tasks/:id', async (req: Request, res: Response) => {
  const { data: oldTask } = await supabase.from('tasks').select('*').eq('id', req.params.id).single();
  const { data, error } = await supabase.from('tasks').update(req.body).eq('id', req.params.id).select();
  
  if (error) return res.status(400).json({ error: error.message });

  // Record History
  await supabase.from('task_history').insert([{
    task_id: req.params.id,
    action: req.body.status ? 'status_changed' : 'updated',
    old_value: oldTask,
    new_value: data[0]
  }]);

  res.json(data[0]);
});

// 5. Delete Task
app.delete('/api/tasks/:id', async (req: Request, res: Response) => {
  await supabase.from('tasks').delete().eq('id', req.params.id);
  res.status(204).send();
});

// Endpoint for the Flutter "Preview" feature
app.post('/api/tasks/classify', (req: Request, res: Response) => {
  const { title, description } = req.body;
  res.json(classifyTask(title, description));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));