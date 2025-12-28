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
  
  // Category Logic
  let category = 'general';
  if (/meeting|schedule|call|appointment|deadline/.test(content)) category = 'scheduling';
  else if (/payment|invoice|bill|budget|cost|expense/.test(content)) category = 'finance';
  else if (/bug|fix|error|install|repair|maintain/.test(content)) category = 'technical';
  else if (/safety|hazard|inspection|compliance|ppe/.test(content)) category = 'safety';

  // Priority Logic
  let priority = 'low';
  if (/urgent|asap|immediately|today|critical|emergency/.test(content)) priority = 'high';
  else if (/soon|important|week/.test(content)) priority = 'medium';

  // Suggested Actions
  const actionsMap: Record<string, string[]> = {
    scheduling: ["Block calendar", "Send invite", "Prepare agenda"],
    finance: ["Check budget", "Get approval", "Update records"],
    technical: ["Diagnose issue", "Assign technician", "Document fix"],
    safety: ["Conduct inspection", "File report", "Notify supervisor"],
    general: ["Review task", "Set reminder"]
  };

  // Entity Extraction (Simple Regex)
  const entities = {
    dates: content.match(/\d{4}-\d{2}-\d{2}/g) || [],
    people: content.match(/(?:with|by|assign to)\s+([A-Z][a-z]+)/g)?.map(s => s.split(' ').pop()) || []
  };

  return { category, priority, suggested_actions: actionsMap[category], extracted_entities: entities };
};

// --- API ENDPOINTS ---

// Create Task
app.post('/api/tasks', async (req: Request, res: Response) => {
  try {
    const { title, description, assigned_to, due_date } = req.body;
    const smartData = classifyTask(title, description);

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ 
        title, 
        description, 
        assigned_to, 
        due_date, 
        ...smartData,
        status: 'pending'
      }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List Tasks with Filters
app.get('/api/tasks', async (req: Request, res: Response) => {
  const { status, category, priority, limit = 10, offset = 0 } = req.query;
  let query = supabase.from('tasks').select('*', { count: 'exact' });

  if (status) query = query.eq('status', status as string);
  if (category) query = query.eq('category', category as string);
  if (priority) query = query.eq('priority', priority as string);

  const { data, count, error } = await query
    .range(Number(offset), Number(offset) + Number(limit) - 1)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json({ data, total: count });
});

// Get Task Details with History
app.get('/api/tasks/:id', async (req: Request, res: Response) => {
    const { data: task } = await supabase.from('tasks').select('*').eq('id', req.params.id).single();
    const { data: history } = await supabase.from('task_history').select('*').eq('task_id', req.params.id);
    res.json({ ...task, history });
});

// Update Task
app.patch('/api/tasks/:id', async (req: Request, res: Response) => {
    const { data, error } = await supabase.from('tasks').update(req.body).eq('id', req.params.id).select();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data[0]);
});

// Delete Task
app.delete('/api/tasks/:id', async (req: Request, res: Response) => {
    await supabase.from('tasks').delete().eq('id', req.params.id);
    res.status(204).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));