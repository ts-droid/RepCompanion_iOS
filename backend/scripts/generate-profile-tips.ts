
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

// Zod schema for Tips
const tipSchema = z.object({
  tipText: z.string(),
  category: z.string(), // nutrition, recovery, hypertrophy, etc.
  sport: z.string().nullable(), // specific sport or null for general
  affiliateLink: z.string().optional(),
});

const responseSchema = z.object({
  tips: z.array(tipSchema)
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

    // Define segments for generation
    const segments = [
        { age: '18–29', gender: 'man', level: 'nybörjare', goal: 'build_muscle' },
        { age: '18–29', gender: 'kvinna', level: 'nybörjare', goal: 'build_muscle' },
        { age: '30–39', gender: 'man', level: 'van', goal: 'build_muscle' },
        { age: '40–59', gender: 'man', level: 'nybörjare', goal: 'health' },
         { age: '40–59', gender: 'kvinna', level: 'nybörjare', goal: 'health' },
        { age: '18–29', gender: 'både', level: 'avancerad', goal: 'performance' }
    ];

    let totalTips = 0;

    for (const seg of segments) {
        await log(`Generating tips for: ${seg.age}, ${seg.gender}, ${seg.level}, ${seg.goal}...`, 'info');

        const prompt = `
        Generate 5 UNIQUE, FACTUAL, SPORTS-SCIENCE BACKED training tips for a user with this profile:
        - Age: ${seg.age}
        - Gender: ${seg.gender}
        - Level: ${seg.level}
        - Goal: ${seg.goal}
        
        CRITERIA:
        - Tips must be strictly factual (citing general scientific consensus, no bro-science).
        - Categories: 'nutrition', 'recovery', 'technique', 'safety'.
        - Tone: Professional, encouraging, authoritative.
        - Language: SWEDISH.
        
        Return JSON: { tips: [{ tipText, category, sport: null }] }
        `;

        try {
            const response = await openai.chat.completions.create({
                model: model,
                messages: [
                    { role: 'system', content: 'You are a sports scientist and simplified coach.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            });

            const content = response.choices[0].message.content || '{}';
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}');
            if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON found");
            const cleanContent = content.substring(jsonStart, jsonEnd + 1);
            
            const result = responseSchema.parse(JSON.parse(cleanContent));

            for (const tip of result.tips) {
                // Generate a unique ID (simple random or UUID logic)
                const id = 'TIP-' + Math.random().toString(36).substr(2, 9).toUpperCase();

                await client.query(`
                    INSERT INTO profile_training_tips (
                        id, tip_text, age_group, sport, category, gender, training_level, affiliate_link
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    id, tip.tipText, seg.age, null, tip.category, seg.gender, seg.level, tip.affiliateLink || null
                ]);
            }
            await log(`Added ${result.tips.length} tips for segment`, 'success');
            totalTips += result.tips.length;

        } catch (e) {
             await log(`Failed to generate tips: ${e}`, 'error');
        }
    }
    
     await log(`Grand total: Added ${totalTips} new tips.`, 'success');

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
