
import { db } from "../server/db";
import { exercises } from "../shared/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Checking for exercises with 'unknown' or empty required equipment...");
  
  const unknownExercises = await db.select()
    .from(exercises)
    .where(sql`required_equipment @> ARRAY['unknown']::text[] OR required_equipment = ARRAY[]::text[]`);

  console.log(`Found ${unknownExercises.length} exercises with 'unknown' or empty equipment.`);
  
  if (unknownExercises.length > 0) {
    console.log("\nSample:");
    unknownExercises.slice(0, 10).forEach(ex => {
      console.log(`- ${ex.name} (ID: ${ex.exerciseId}, Eq: ${JSON.stringify(ex.requiredEquipment)})`);
    });
  }

  process.exit(0);
}

main().catch(console.error);
