
import { db } from "../server/db";
import { exercises, equipmentCatalog } from "@shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
});

async function main() {
  console.log("Fetching exercises and equipment...");
  const allExercises = await db.select().from(exercises);
  const allEquipment = await db.select().from(equipmentCatalog);
  
  // Build equipment key list and mapping
  const equipmentKeyList = allEquipment
    .filter(e => e.equipmentKey) // Only include items with keys
    .map(e => e.equipmentKey)
    .join(", ");
  
  // Create map: equipmentKey (lowercase) -> equipmentKey (actual)
  const equipmentKeyMap = new Map<string, string>();
  allEquipment.forEach(e => {
    if (e.equipmentKey) {
      equipmentKeyMap.set(e.equipmentKey.toLowerCase(), e.equipmentKey);
      // Also map English name to key for flexibility
      if (e.nameEn) {
        equipmentKeyMap.set(e.nameEn.toLowerCase(), e.equipmentKey);
      }
    }
  });
  
  console.log(`Found ${allExercises.length} exercises to enrich.`);
  console.log(`Equipment catalog has ${allEquipment.length} items.`);
  
  const BATCH_SIZE = 30;
  const mismatches: { exerciseId: string; exerciseName: string; invalidEquipment: string[] }[] = [];
  let updatedCount = 0;
  
  for (let i = 0; i < allExercises.length; i += BATCH_SIZE) {
    const batch = allExercises.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allExercises.length / BATCH_SIZE)} (${batch.length} exercises)...`);
    
    // Use English names when available, fallback to Swedish
    const exercisesPrompt = batch.map(e => ({
      id: e.id,
      name: e.nameEn || e.name, // Prefer English name
      description: e.description || ""
    }));

    const prompt = `
You are an expert personal trainer and biomechanics specialist.

I have a list of exercises. For each exercise, provide:

1. **PRIMARY MUSCLES**: Main muscle groups worked (from: Chest, Back, Quads, Hamstrings, Glutes, Calves, Shoulders, Biceps, Triceps, Forearms, Abs, Obliques, Lower Back, Traps, Hip Flexors, Adductors, Abductors)

2. **SECONDARY MUSCLES**: Supporting muscle groups (synergists)

3. **REQUIRED EQUIPMENT**: Equipment needed from this list ONLY:
   [${equipmentKeyList}]
   
   Rules:
   - Use EXACT keys from the list above
   - For bodyweight exercises, use empty array []
   - If unsure, pick the closest match from the list
   - Do NOT invent new equipment names

Return STRICT JSON:
{
  "updates": [
    {
      "id": "exercise-id",
      "primaryMuscles": ["Muscle1", "Muscle2"],
      "secondaryMuscles": ["Muscle3"],
      "requiredEquipment": ["equipment_key_from_list"]
    }
  ]
}

Exercises:
${JSON.stringify(exercisesPrompt, null, 2)}
    `;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a fitness expert. Return only valid JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3 // Lower temperature for more consistent results
      });

      const content = response.choices[0].message.content;
      if (!content) {
        console.warn("Empty response from AI");
        continue;
      }

      const result = JSON.parse(content);
      
      if (!result.updates || !Array.isArray(result.updates)) {
        console.warn("Invalid response structure from AI");
        continue;
      }
      
      for (const update of result.updates) {
        const validEquipment: string[] = [];
        const invalidEquipment: string[] = [];
        
        if (Array.isArray(update.requiredEquipment)) {
          for (const eqKey of update.requiredEquipment) {
            const lowerKey = String(eqKey).toLowerCase().trim();
            
            // Skip bodyweight/none
            if (lowerKey === 'bodyweight' || lowerKey === 'none' || lowerKey === '') continue;

            // Try exact match first
            const mappedKey = equipmentKeyMap.get(lowerKey);
            if (mappedKey) {
              if (!validEquipment.includes(mappedKey)) {
                validEquipment.push(mappedKey);
              }
            } else {
              invalidEquipment.push(eqKey);
            }
          }
        }

        if (invalidEquipment.length > 0) {
          const ex = allExercises.find(e => e.id === update.id);
          console.warn(`  ⚠️  [MISMATCH] ${ex?.name || update.id}: ${invalidEquipment.join(", ")}`);
          mismatches.push({
            exerciseId: update.id,
            exerciseName: ex?.name || "Unknown",
            invalidEquipment
          });
        }

        // Update DB with enriched data
        if (update.primaryMuscles && Array.isArray(update.primaryMuscles) && update.primaryMuscles.length > 0) {
          await db.update(exercises)
            .set({
              primaryMuscles: update.primaryMuscles,
              secondaryMuscles: update.secondaryMuscles || [],
              requiredEquipment: validEquipment
            })
            .where(eq(exercises.id, update.id));
          updatedCount++;
          process.stdout.write("✓");
        } else {
          process.stdout.write("·"); // Skipped (no muscles identified)
        }
      }
      
      console.log(""); // New line after batch

    } catch (err: any) {
      console.error(`\n  ❌ Error processing batch: ${err.message}`);
    }
  }
  
  // Generate report
  console.log(`\n${"=".repeat(60)}`);
  console.log(`ENRICHMENT COMPLETE`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Total Exercises: ${allExercises.length}`);
  console.log(`Successfully Updated: ${updatedCount}`);
  console.log(`Mismatches Found: ${mismatches.length}`);
  
  const report = `# Exercise Enrichment Report

**Generated:** ${new Date().toISOString()}

## Summary

- **Total Exercises**: ${allExercises.length}
- **Successfully Updated**: ${updatedCount}
- **Equipment Mismatches**: ${mismatches.length}

## Equipment Mismatches

These exercises had equipment that couldn't be matched to your catalog. Review manually:

| Exercise Name | Invalid Equipment Keys |
| :------------ | :--------------------- |
${mismatches.map(m => `| ${m.exerciseName} | \`${m.invalidEquipment.join("`, `")}\` |`).join("\n")}

## Next Steps

1. Review mismatches above
2. Either:
   - Add missing equipment to catalog with proper \`equipmentKey\`
   - Create aliases in \`equipment_aliases\` table
   - Manually correct the exercise equipment in admin dashboard
`;
  
  const fs = await import("fs");
  await fs.promises.writeFile("enrichment_report.md", report);
  console.log(`\n📄 Report saved to: enrichment_report.md`);
}

main().catch(console.error);
