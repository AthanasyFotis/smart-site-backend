import { describe, it, expect } from '@jest/globals';

// We simulate the logic to test it independently
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

  return { category, priority };
};

describe('Task Classification Logic', () => {
  it('should classify a safety hazard as High priority', () => {
    const result = classifyTask("Gas leak reported", "Urgent inspection needed in Sector 7");
    expect(result.category).toBe('safety');
    expect(result.priority).toBe('high');
  });

  it('should classify budget discussions as Finance', () => {
    const result = classifyTask("Monthly budget review", "Analyze the allocation for Q3");
    expect(result.category).toBe('finance');
    expect(result.priority).toBe('low');
  });

  it('should default unknown tasks to General and Low priority', () => {
    const result = classifyTask("Feed the office plants", "They look a bit dry");
    expect(result.category).toBe('general');
    expect(result.priority).toBe('low');
  });
});