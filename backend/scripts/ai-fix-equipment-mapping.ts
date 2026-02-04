
import { db } from "../server/db";
import { exercises, equipmentCatalog } from "../shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

// Initialize AI Client based on available environment variables
// Priorities: DeepSeek -> Gemini -> OpenAI
// (Using logic similar to server/ai-service.ts but adapted for this script)

function getAIClient() {
  if (process.env.AI_INTEGRATIONS_DEEPSEEK_API_KEY) {
    console.log("Using DeepSeek for AI mapping...");
    return {
      client: new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
        apiKey: process.env.AI_INTEGRATIONS_DEEPSEEK_API_KEY
      }),
      model: "deepseek-chat"
    };
  }
  
  if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
    console.log("Using Gemini for AI mapping...");
    return {
      client: new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY
      }),
      model: "gemini-2.0-flash-exp"
    };
  }

  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    console.log("Using OpenAI (Integrations) for AI mapping...");
    return {
      client: new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
      }),
      model: "gpt-4o"
    };
  }

  if (process.env.OPENAI_API_KEY) {
    console.log("Using OpenAI (Standard) for AI mapping...");
    return {
      client: new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      }),
      model: "gpt-4o"
    };
  }

  throw new Error("No AI API Key found. Please set OPENAI_API_KEY, AI_INTEGRATIONS_GEMINI_API_KEY, or AI_INTEGRATIONS_DEEPSEEK_API_KEY.");
}

async function main() {
  let aiConfig;
  try {
    aiConfig = getAIClient();
  } catch (e: any) {
    console.error(e.message);
    process.exit(1);
  }

  console.log("Fetching equipment catalog...");
  const catalog = await db.select().from(equipmentCatalog);
  const validKeys = new Set(catalog.map((e) => e.equipmentKey));
  
  // Create a context string for the AI
  const catalogList = catalog.map(e => `- ${e.name} (Key: ${e.equipmentKey})`).join("\n");

  console.log(`Found ${catalog.length} equipment items in catalog.`);

  console.log("Fetching exercises...");
  const allExercises = await db.select().from(exercises);
  console.log(`Found ${allExercises.length} exercises.`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let processedCount = 0;

  for (const ex of allExercises) {
    const currentEq = ex.requiredEquipment || [];
    
    // Check if all current equipment items are already valid keys
    const allValid = currentEq.length > 0 && currentEq.every(req => validKeys.has(req));

    if (allValid) {
      // console.log(`Skipping ${ex.name} (already valid: ${currentEq.join(", ")})`);
      skippedCount++;
      continue;
    }

    console.log(`Processing [${++processedCount}] ${ex.name} (Current: ${JSON.stringify(currentEq)})`);

    try {
      const response = await aiConfig.client.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: "system",
            content: `You are an expert fitness data specialist. Your task is to map an exercise's equipment requirements to a standardized list of equipment keys.
            
Here is the Standard Equipment Catalog (Format: Name (Key: key)):
${catalogList}

Instructions:
1. Analyze the exercise name and current equipment requirements.
2. Select the most appropriate equipment keys from the Standard Catalog.
3. If the exercise requires multiple pieces of equipment (e.g., "Barbell" AND "Bench"), include both keys.
4. If the exercise works with "Bodyweight" and requires no equipment, map it to the 'bodyweight' key if available, or return an empty list if strict. (Looking at catalog, 'bodyweight' is likely a key. If not, check list).
5. If the current equipment is "None" or empty, map to "bodyweight" (or equivalent key in catalog).
6. Be precise. Do not invent keys. Only use keys from the list provided.
7. Return ONLY a JSON array of strings, e.g., ["barbell", "bench"]. Do not include markdown code blocks.`
          },
          {
            role: "user",
            content: `Exercise Name: "${ex.name}"
Current Equipment: ${JSON.stringify(currentEq)}
Description: ${ex.description || "N/A"}

Map to standardized Equipment Keys:`
          }
        ],
        temperature: 0,
      });

      const rawContent = response.choices[0].message.content?.trim() || "[]";
      // Remove markdown code blocks if present
      const cleanContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();
      
      let mappedKeys: string[] = [];
      try {
        mappedKeys = JSON.parse(cleanContent);
      } catch (e) {
        console.error(`Failed to parse AI response for ${ex.name}: ${rawContent}`);
        errorCount++;
        continue;
      }

      // Validate keys
      const validatedKeys = mappedKeys.filter(k => validKeys.has(k));
      
      if (validatedKeys.length === 0 && mappedKeys.length > 0) {
        console.warn(`AI returned no valid keys for ${ex.name} (Raw: ${mappedKeys.join(", ")}). skipping update.`);
        errorCount++;
        continue;
      }

      // Special handling for empty result -> if original was not empty, this might be data loss, but maybe explicit "none". 
      // If result is empty, verify if it should be bodyweight or if the AI failed.
      if (validatedKeys.length === 0) {
        // If it was already empty, no change.
        if (currentEq.length === 0) {
          skippedCount++;
          continue;
        }
        // If it had something but now nothing -> potential issue? Or maybe it was mapped to bodyweight and bodyweight key is missing? 
        // We will trust AI for now but log it.
        console.log(`AI mapped ${ex.name} to [] (Current was ${JSON.stringify(currentEq)})`);
      }

      // Update DB
      if (JSON.stringify(validatedKeys.sort()) !== JSON.stringify(currentEq.sort())) {
        await db.update(exercises)
          .set({ requiredEquipment: validatedKeys })
          .where(eq(exercises.id, ex.id));
        
        console.log(`Updated ${ex.name}: ${JSON.stringify(currentEq)} -> ${JSON.stringify(validatedKeys)}`);
        updatedCount++;
      } else {
        console.log(`No change for ${ex.name}`);
        skippedCount++;
      }

    } catch (error) {
      console.error(`Error processing ${ex.name}:`, error);
      errorCount++;
    }
    
    // Small delay
    await new Promise(r => setTimeout(r, 200));
  }

  console.log("Done!");
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  process.exit(0);
}

main().catch(console.error);
