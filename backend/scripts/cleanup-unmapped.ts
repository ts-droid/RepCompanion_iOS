import { db } from "../server/db";
import { exercises, unmappedExercises, exerciseAliases } from "../shared/schema";
import { eq, or, sql } from "drizzle-orm";
import { normalizeName } from "../server/exercise-matcher";

async function cleanup() {
  console.log("[CLEANUP] Starting unmapped exercises cleanup...");
  
  const unmapped = await db.select().from(unmappedExercises);
  console.log(`[CLEANUP] Found ${unmapped.length} unmapped entries.`);
  
  let deletedCount = 0;
  
  for (const item of unmapped) {
    const normalized = normalizeName(item.aiName);
    
    // Check 1: Direct match in exercises table (name or nameEn)
    const exactMatch = await db
      .select()
      .from(exercises)
      .where(
        sql`LOWER(REGEXP_REPLACE(${exercises.nameEn}, '[^a-z0-9åäö\\s]', '', 'ig')) = ${normalized}
         OR LOWER(REGEXP_REPLACE(${exercises.name}, '[^a-z0-9åäö\\s]', '', 'ig')) = ${normalized}`
      )
      .limit(1);
      
    if (exactMatch.length > 0) {
      console.log(`✅ EXACT MATCH: "${item.aiName}" matches exercise "${exactMatch[0].name}"`);
      await db.delete(unmappedExercises).where(eq(unmappedExercises.id, item.id));
      deletedCount++;
      continue;
    }
    
    // Check 2: Match in aliases table
    const aliasMatch = await db
      .select()
      .from(exerciseAliases)
      .where(eq(exerciseAliases.aliasNorm, normalized))
      .limit(1);
      
    if (aliasMatch.length > 0) {
      console.log(`✅ ALIAS MATCH: "${item.aiName}" matches alias for exercise "${aliasMatch[0].exerciseId}"`);
      await db.delete(unmappedExercises).where(eq(unmappedExercises.id, item.id));
      deletedCount++;
      continue;
    }
  }
  
  console.log(`\n[CLEANUP] Done! Deleted ${deletedCount} unmapped entries.`);
  process.exit(0);
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
