
import { db } from "./server/db";
import { exercises, unmappedExercises, users } from "./shared/schema";

async function check() {
  try {
    const exCount = await db.select().from(exercises);
    const unmappedCount = await db.select().from(unmappedExercises);
    const userCount = await db.select().from(users);
    
    console.log("Exercises:", exCount.length);
    console.log("Unmapped:", unmappedCount.length);
    console.log("Users:", userCount.length);
  } catch (e) {
    console.error("Error:", e);
  } finally {
    process.exit(0);
  }
}

check();
