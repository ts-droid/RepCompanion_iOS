
import { db } from "./server/db";
import { exercises } from "./shared/schema";
import { isNull, eq, or } from "drizzle-orm";

async function analyze() {
  try {
    const allExercises = await db.select().from(exercises);
    const missingV4 = allExercises.filter(ex => !ex.exerciseId);
    const hasV4 = allExercises.filter(ex => !!ex.exerciseId);

    console.log("Total Exercises:", allExercises.length);
    console.log("Exercises with V4 ID:", hasV4.length);
    console.log("Exercises MISSING V4 ID:", missingV4.length);

    if (missingV4.length > 0) {
      console.log("\nExamples of missing V4 IDs:");
      missingV4.slice(0, 10).forEach(ex => {
        console.log(`- ${ex.name} (ID: ${ex.id})`);
      });
    }

    // Check for "Coach-" prefix which might be candidates for merging or separate ID mapping
    const coachEx = allExercises.filter(ex => ex.name.includes("Coach-"));
    console.log("\nExercises with 'Coach-' prefix:", coachEx.length);

  } catch (e) {
    console.error("Error during analysis:", e);
  } finally {
    process.exit(0);
  }
}

analyze();
