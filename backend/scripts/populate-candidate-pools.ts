#!/usr/bin/env tsx

/**
 * Populate Candidate Pools Script
 * 
 * Uses AI (DeepSeek/OpenAI) to categorize all exercises in the database
 * into 'candidate pools' (buckets) for V4 program generation.
 * 
 * Usage:
 *   AI_PROMPT_VERSION=v4 DATABASE_URL=... npm run script scripts/populate-candidate-pools.ts
 */

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

// Zod schema for the AI response
const bucketSchema = z.object({
  buckets: z.record(z.array(z.string())) // bucket_name -> array of exercise_ids
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

    // 1. Fetch all exercises
    await log('Fetching all exercises...');
    const exercisesResult = await client.query(`
      SELECT id, name, exercise_id, "primary_muscles", "secondary_muscles", "required_equipment"
      FROM exercises
      -- Fetch all exercises (assuming checking catalog)
    `);
    
    const exercises = exercisesResult.rows;
    await log(`Found ${exercises.length} exercises`, 'info');

    if (exercises.length === 0) {
      await log('No exercises found to categorize', 'warn');
      return;
    }

    // 2. Prepare exercises for AI (minimal data to save tokens)
    const exerciseList = exercises.map(ex => {
      // Merge muscles arrays safely
      const pMuscles = ex.primary_muscles || [];
      const sMuscles = ex.secondary_muscles || [];
      const allMuscles = Array.from(new Set([...pMuscles, ...sMuscles]));

      return {
        id: ex.exercise_id || ex.id,
        name: ex.name,
        muscles: allMuscles,
        equipment: ex.required_equipment || []
      };
    });

    // 3. Define the prompt for categorizing into hypertrophy/strength buckets
    // We want buckets like: 'push_horizontal', 'push_vertical', 'pull_vertical', etc.
    const systemPrompt = `
You are an expert strength and conditioning coach.
Your task is to categorize a list of exercises into specific movement patterns (buckets) for a V4 hypertrophy/strength program generator.

REQUIRED BUCKETS:
- push_horizontal (Bench press, pushups, chest press)
- push_vertical (OHP, shoulder press)
- pull_vertical (Pullups, lat pulldown)
- pull_horizontal (Rows, face pulls)
- legs_squat (Squats, leg press, lunges)
- legs_hinge (Deadlift, RDL, hip thrust)
- isolation_arms (Bicep curls, tricep extensions)
- isolation_shoulders (Lateral raises, rear delt flyes)
- isolation_legs (Leg extension, leg curl, calves)
- core (Planks, crunches)
- cardio (Running, cycling, rowing)

RULES:
1. Every exercise MUST belong to at least one bucket.
2. An exercise can belong to multiple buckets if relevant (e.g. Cleans might be hinge + shrugs).
3. Be precise based on the exercise name and muscle groups.
4. Return ONLY a JSON object with keys as bucket names and values as arrays of exercise_ids.
`;

    // Process in chunks if too many exercises? 
    // For ~800 exercises, strict JSON might be large but likely fits in context window of modern models (128k).
    // Let's try sending all at once first.
    
    // Process in chunks to avoid max token limits
    const CHUNK_SIZE = 50;
    const allBuckets: Record<string, string[]> = {};
    
    for (let i = 0; i < exerciseList.length; i += CHUNK_SIZE) {
      const chunk = exerciseList.slice(i, i + CHUNK_SIZE);
      await log(`Processing chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(exerciseList.length/CHUNK_SIZE)} (${chunk.length} exercises)...`, 'info');
      
      try {
        const response = await openai.chat.completions.create({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(chunk) }
          ],
          response_format: { type: 'json_object' },
            max_tokens: 4000 // Ensure enough space for response
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error('No content from AI');

        // Robust JSON extraction
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');
        
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error('No JSON object found in response');
        }
        
        const cleanContent = content.substring(jsonStart, jsonEnd + 1);
        await log(`Content prefix: ${cleanContent.substring(0, 50)}...`, 'info');
        
        let parsed: any;
        try {
          parsed = JSON.parse(cleanContent);
        } catch (e) {
          console.error('Failed to parse (truncated?):', cleanContent.substring(cleanContent.length - 100));
          throw e;
        }

        // Handle case where AI returns direct buckets object instead of { buckets: ... }
        if (!parsed.buckets && (parsed.push_horizontal || parsed.hypertrophy || Object.keys(parsed).length > 0)) {
            parsed = { buckets: parsed };
        }

        const result = bucketSchema.parse(parsed);
        
        // Merge buckets
        Object.entries(result.buckets).forEach(([bucketName, ids]) => {
          if (!allBuckets[bucketName]) {
            allBuckets[bucketName] = [];
          }
          allBuckets[bucketName].push(...ids);
        });
        
      } catch (err) {
        await log(`Error processing chunk: ${err}`, 'error');
        // Continue to next chunk? Or fail? Fail is safer.
        throw err;
      }
    }

    await log(`Total categorized exercises: ${Object.values(allBuckets).reduce((acc, val) => acc + val.length, 0)}`, 'success');

    // 4. Insert into candidate_pools
    const poolTypes = ['hypertrophy', 'strength'];
    
    for (const type of poolTypes) {
      const hash = Math.random().toString(36).substring(7);
      
      const existing = await client.query(`
        SELECT id FROM candidate_pools 
        WHERE scope = 'global' AND pool_type = $1
      `, [type]);

      if (existing.rows.length > 0) {
        await client.query(`
          UPDATE candidate_pools 
          SET buckets = $1, hash = $2, version = version + 1
          WHERE id = $3
        `, [JSON.stringify(allBuckets), hash, existing.rows[0].id]);
        await log(`Updated global '${type}' pool`, 'success');
      } else {
        await client.query(`
          INSERT INTO candidate_pools (scope, pool_type, buckets, hash)
          VALUES ('global', $1, $2, $3)
        `, [type, JSON.stringify(allBuckets), hash]);
        await log(`Created global '${type}' pool`, 'success');
      }
    }

  } catch (error: any) {
    await log(`Error: ${error.message}`, 'error');
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Main execution
const databaseUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ No database URL found. Set DATABASE_URL or RAILWAY_DATABASE_URL');
  process.exit(1);
}

run(databaseUrl);
