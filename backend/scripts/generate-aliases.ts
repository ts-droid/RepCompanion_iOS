
import pkg from 'pg';
const { Client } = pkg;
import OpenAI from 'openai';
import { z } from 'zod';

// Initialize AI client 
let openai: OpenAI;
let model: string;

const deepseekKey = process.env.DEEPSEEK_API_KEY || process.env.AI_INTEGRATIONS_DEEPSEEK_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

if (deepseekKey) {
  openai = new OpenAI({ apiKey: deepseekKey, baseURL: 'https://api.deepseek.com' });
  model = 'deepseek-chat';
} else if (geminiKey) {
  openai = new OpenAI({ apiKey: geminiKey, baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/' });
  model = 'gemini-2.0-flash-exp';
} else if (openaiKey) {
  openai = new OpenAI({ apiKey: openaiKey, baseURL: 'https://api.openai.com/v1' });
  model = 'gpt-4o';
} else {
  console.error('❌ No API key found.');
  process.exit(1);
}

// Zod schema for aliases
const aliasSchema = z.object({
  aliases: z.array(z.string())
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

    // Fetch all exercises
    const res = await client.query('SELECT exercise_id, name, name_en FROM exercises');
    const exercises = res.rows;
    await log(`Found ${exercises.length} exercises to process for aliases`, 'info');
    
    let totalAliases = 0;

    // Process in chunks to save time
    const CHUNK_SIZE = 10;
    
    for (let i = 0; i < exercises.length; i += CHUNK_SIZE) {
        const chunk = exercises.slice(i, i + CHUNK_SIZE);
        
        await log(`Processing chunk ${Math.ceil(i/CHUNK_SIZE) + 1}/${Math.ceil(exercises.length/CHUNK_SIZE)}...`, 'info');

        // Create a prompt for the whole chunk
        const exercisesList = chunk.map(e => `- ID: ${e.exercise_id}, Name: ${e.name} / ${e.name_en || ''}`).join('\n');
        
        const prompt = `
        For each of the following exercises, generate a list of COMMON synonyms/aliases (English AND Swedish).
        
        Exercises:
        ${exercisesList}
        
        CRITERIA:
        - Include common misspellings if they are frequent.
        - Include slang (e.g., "Bänken" for Bench Press).
        - Include English variations (e.g., "DB Press" for Dumbbell Press).
        - RETURN JSON mapping exercise_id to array of alias strings.
        
        Example JSON:
        {
            "aliases": {
                "uuid-1": ["Bänken", "Bench", "Flat Bench"],
                "uuid-2": ["Knäböj", "Squat", "Back Squat"]
            }
        }
        `;

        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: [
                    { role: 'system', content: 'You are a gym linguistics expert.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0].message.content || '{}';
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found");
            const cleanContent = content.substring(jsonStart, jsonEnd + 1);
            
            const result = JSON.parse(cleanContent);
            const aliasMap = result.aliases || {};

            for (const [exId, aliases] of Object.entries(aliasMap)) {
                if (!Array.isArray(aliases)) continue;
                
                for (const alias of aliases) {
                    const norm = alias.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
                    if (norm.length < 2) continue;

                    await client.query(`
                        INSERT INTO exercise_aliases (exercise_id, alias, alias_norm, source)
                        VALUES ($1, $2, $3, 'ai_gen')
                        ON CONFLICT (alias_norm) DO NOTHING
                    `, [exId, alias, norm]);
                }
                totalAliases += aliases.length;
            }

        } catch (e) {
             await log(`Failed to generate aliases for chunk: ${e}`, 'error');
        }
    }
    
     await log(`Grand total: Added ${totalAliases} new aliases.`, 'success');

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
