
import pkg from 'pg';
const { Client } = pkg;
import OpenAI from 'openai';
import { z } from 'zod';

// Initialize OpenAI client with robust provider selection
let openai: OpenAI;
let model: string;

const deepseekKey = process.env.DEEPSEEK_API_KEY || process.env.AI_INTEGRATIONS_DEEPSEEK_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

if (deepseekKey) {
  console.log('Using DeepSeek for generation');
  openai = new OpenAI({
    apiKey: deepseekKey,
    baseURL: 'https://api.deepseek.com',
  });
  model = 'deepseek-chat';
} else if (geminiKey) {
  console.log('Using Gemini for generation');
  openai = new OpenAI({
    apiKey: geminiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  });
  model = 'gemini-2.0-flash-exp';
} else if (openaiKey) {
  console.log('Using OpenAI for generation');
  openai = new OpenAI({
    apiKey: openaiKey,
    baseURL: 'https://api.openai.com/v1',
  });
  model = 'gpt-4o';
} else {
  console.error('❌ No API key found for DeepSeek, Gemini, or OpenAI');
  process.exit(1);
}

// Zod schema for AI response (Relaxed)
const newExerciseSchema = z.object({
  name: z.string(),
  name_en: z.string(),
  description: z.string().optional().default(''),
  category: z.enum(['strength', 'cardio', 'mobility', 'plyometrics']).optional().default('strength'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
  primary_muscles: z.array(z.string()),
  secondary_muscles: z.array(z.string()).optional().default([]),
  required_equipment: z.array(z.string()).optional().default([]),
  movement_pattern: z.string().optional().default('isolation'), 
  is_compound: z.boolean().optional().default(false),
});

const responseSchema = z.object({
  exercises: z.array(newExerciseSchema)
});

async function log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const prefix = { info: '📋', success: '✅', error: '❌', warn: '⚠️' }[level];
  console.log(`${prefix} ${message}`);
}

async function run(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await log('Connected to database', 'success');

    // 1. Fetch existing exercise names to avoid duplicates
    const res = await client.query('SELECT name, name_en FROM exercises');
    const existingNames = new Set([
        ...res.rows.map(r => r.name.toLowerCase()),
        ...res.rows.map(r => (r.name_en || '').toLowerCase())
    ]);
    await log(`Found ${existingNames.size} existing exercises`, 'info');

    // 2. Define targets for generation
    const muscleGroups = [
        'Chest', 'Back', 'Shoulders', 'Legs (Quads)', 'Legs (Hamstrings)', 'Glutes', 'Biceps', 'Triceps', 'Core', 'Cardio'
    ];

    let totalAdded = 0;

    for (const group of muscleGroups) {
        await log(`Generating exercises for: ${group}...`, 'info');

        const prompt = `
        Generate 10 unique, high-quality gym exercises for "${group}".
        
        CRITERIA:
        - Include a mix of compound and isolation.
        - Include a mix of machine, dumbbell, barbell, and bodyweight.
        - AVOID duplicates if they are extremely common (Assume I have the basics like Bench Press, Squat, Deadlift).
        - Focus on variations or specific effective exercises that might be missing (e.g., "Incline Dumbbell Fly", "Bulgarian Split Squat", "Face Pull").
        - "name" should be in SWEDISH.
        - "name_en" should be in ENGLISH.
        - "primary_muscles" and "secondary_muscles" must be accurate.
        
        Valid categories: 'strength', 'cardio', 'mobility', 'plyometrics'
        Valid difficulties: 'beginner', 'intermediate', 'advanced'
        
        Return JSON format: { exercises: [...] }
        `;

        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: [
                    { role: 'system', content: 'You are an expert fitness coach building a database.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0].message.content || '{}';
            
             // Robust JSON extraction
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found");
            
            const cleanContent = content.substring(jsonStart, jsonEnd + 1);
            const parsed = JSON.parse(cleanContent);
            const result = responseSchema.parse(parsed);

            let addedForGroup = 0;
            for (const ex of result.exercises) {
                if (existingNames.has(ex.name.toLowerCase()) || existingNames.has(ex.name_en.toLowerCase())) {
                    continue; // Skip duplicates
                }

                await client.query(`
                    INSERT INTO exercises (
                        name, name_en, description, category, difficulty, 
                        primary_muscles, secondary_muscles, required_equipment, 
                        movement_pattern, is_compound
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (name) DO NOTHING
                `, [
                    ex.name, ex.name_en, ex.description, ex.category, ex.difficulty,
                    ex.primary_muscles, ex.secondary_muscles, ex.required_equipment,
                    ex.movement_pattern, ex.is_compound
                ]);
                
                existingNames.add(ex.name.toLowerCase());
                existingNames.add(ex.name_en.toLowerCase());
                addedForGroup++;
            }
            await log(`Added ${addedForGroup} exercises for ${group}`, 'success');
            totalAdded += addedForGroup;

        } catch (e) {
            await log(`Failed to generate for ${group}: ${e}`, 'error');
        }
    }

    await log(`Grand total: Added ${totalAdded} new exercises.`, 'success');

  } catch (error: any) {
    await log(`Error: ${error.message}`, 'error');
    process.exit(1);
  } finally {
    await client.end();
  }
}

const databaseUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ No database URL found.');
  process.exit(1);
}
run(databaseUrl);
