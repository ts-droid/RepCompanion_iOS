
import { db } from "../server/db";
import { exercises, exerciseAliases, exerciseStats, exerciseLogs, programTemplateExercises } from "../shared/schema";
import { eq, isNull, and, or, inArray, sql } from "drizzle-orm";
import fs from "fs";
import { normalizeName } from "../server/exercise-matcher";
import { storage } from "../server/storage";

const exercisesJsonPath = "./server/data/exercises.json";

// Direct Swedish/Alias to V4 ID mapping to ensure maximum accuracy
// Keys will be normalized in the script
const DIRECT_V4_MAPPING: Record<string, string> = {
  "latdrag": "BA_Lat_Pulldown_Wide",
  "hammarcurl": "BI_Hammer_Curl",
  "sidlyft": "SH_Lateral_Raise",
  "hantellyft åt sidan": "SH_Lateral_Raise",
  "benböj": "LG_Back_Squat",
  "knäböj": "LG_Back_Squat",
  "bänkpress": "CH_Barbell_Bench_Press",
  "marklyft": "BA_Conventional_Deadlift",
  "axelpress": "SH_Overhead_Press_Barbell",
  "latsdrag": "BA_Lat_Pulldown_Wide",
  "rodd": "BA_Barbell_Bent_Over_Row",
  "bicepscurl": "BI_Barbell_Curl",
  "triceps": "TR_Cable_Triceps_Pushdown_Bar",
  "benpress": "LG_Leg_Press",
  "bencurl": "LG_Lying_Leg_Curl",
  "bensträck": "LG_Leg_Extension",
  "vadpress": "CV_Standing_Calf_Raise",
  "armhävning": "CH_Push_Up",
  "chins": "BA_Pull_Up",
  "dips": "TR_Parallel_Bar_Dip",
  "plankan": "CO_Plank",
  "situps": "CO_Crunch",
  "höftlyft": "LG_Barbell_Hip_Thrust",
  "lutande hantelpress": "CH_Incline_Dumbbell_Press",
  "negativ hantelpress": "CH_Decline_Dumbbell_Press",
  "lutande bänkpress": "CH_Incline_Barbell_Bench_Press",
  "negativ bänkpress": "CH_Decline_Barbell_Bench_Press",
  "hantelpress": "CH_Flat_Dumbbell_Press",
  "hantlar": "CH_Flat_Dumbbell_Press",
  "utfallssteg": "LG_Walking_Lunge",
  "utfall": "LG_Walking_Lunge",
  "sidolyft": "SH_Lateral_Raise",
  "flyes": "CH_Standing_Cable_Fly",
  "cable fly": "CH_Standing_Cable_Fly",
  "benlyft": "CO_Hanging_Leg_Raise",
  "facepull": "BA_Face_Pull",
  "hammercurl": "BI_Hammer_Curl",
  "scottcurl": "BI_Preacher_Curl",
  "rumänsk marklyft": "BA_Romanian_Deadlift",
  "stiff leg deadlift": "BA_Romanian_Deadlift",
  "deadlift": "BA_Conventional_Deadlift",
  "squat": "LG_Back_Squat",
  "bench press": "CH_Barbell_Bench_Press",
  "shoulder press": "SH_Overhead_Press_Barbell",
  "leg press": "LG_Leg_Press",
  "pushup": "CH_Push_Up",
  "pullup": "BA_Pull_Up",
  "hanging leg raise": "CO_Hanging_Leg_Raise",
  "bulgarian": "LG_Bulgarian_Split_Squat",
  "skullcrusher": "TR_Barbell_Skullcrusher",
  "crunch": "CO_Crunch",
  "plank": "CO_Plank",
  "lunge": "LG_Walking_Lunge",
  "kettlebell": "FB_Kettlebell_Swing"
};

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`🚀 Starting V4 ID Mapping (${dryRun ? "DRY RUN" : "LIVE"})`);

  try {
    // 1. Load V4 Catalog
    const v4Catalog = JSON.parse(fs.readFileSync(exercisesJsonPath, "utf-8"));
    const v4Map = new Map();
    v4Catalog.forEach((ex: any) => {
      v4Map.set(normalizeName(ex.name), ex.id);
    });

    // 2. Load exercises missing IDs
    const dbExercises = await db.select().from(exercises).where(isNull(exercises.exerciseId));
    console.log(`Found ${dbExercises.length} exercises missing V4 ID.`);

    let successCount = 0;
    let failCount = 0;

    for (const ex of dbExercises) {
      let matchedV4Id: string | null = null;
      const normalizedName = normalizeName(ex.name);
      
      // Strategy A: Exact match on name (if they were already English)
      matchedV4Id = v4Map.get(normalizedName);

      // Strategy B: Match via Direct V4 Mapping
      if (!matchedV4Id) {
        // Try exact match on normalized name
        for (const [alias, v4Id] of Object.entries(DIRECT_V4_MAPPING)) {
          if (normalizedName === normalizeName(alias)) {
            matchedV4Id = v4Id;
            break;
          }
        }

        // If still no match, try partial match
        if (!matchedV4Id) {
          for (const [alias, v4Id] of Object.entries(DIRECT_V4_MAPPING)) {
            const normalizedAlias = normalizeName(alias);
            if (normalizedName.includes(normalizedAlias) || normalizedAlias.includes(normalizedName)) {
              if (normalizedAlias.length > 5) {
                matchedV4Id = v4Id;
                break;
              }
            }
          }
        }
      }

      // Strategy C: Exact match on name_en if it exists
      if (!matchedV4Id && ex.nameEn) {
        matchedV4Id = v4Map.get(normalizeName(ex.nameEn));
      }

      if (matchedV4Id) {
        // Verify matchedV4Id exists in v4Catalog
        const exists = v4Catalog.find((v: any) => v.id === matchedV4Id);
        if (!exists) {
          console.log(`⚠️  INVALID V4 ID: "${ex.name}" -> ${matchedV4Id} (Skipping)`);
          matchedV4Id = null;
        }
      }

      if (matchedV4Id) {
        // Check if another exercise already has this V4 ID
        const [existing] = await db.select().from(exercises).where(eq(exercises.exerciseId, matchedV4Id));

        if (existing && existing.id !== ex.id) {
          console.log(`🔀 MERGE: "${ex.name}" into existing "${existing.name}" (${matchedV4Id})`);
          successCount++;

          if (!dryRun) {
            try {
              await storage.adminMergeExercises(ex.id, existing.id);
            } catch (mergeError) {
              console.error(`  ❌ Merge failed for "${ex.name}":`, mergeError);
              successCount--;
              failCount++;
            }
          }
        } else {
          console.log(`✅ MATCH: "${ex.name}" -> ${matchedV4Id}`);
          successCount++;

          if (!dryRun) {
            // Update the exercise
            await db.update(exercises)
              .set({ exerciseId: matchedV4Id })
              .where(eq(exercises.id, ex.id));

            // Also create an alias for the Swedish name if it doesn't exist
            try {
              await db.insert(exerciseAliases).values({
                exerciseId: matchedV4Id,
                alias: ex.name,
                aliasNorm: normalizedName,
                lang: "sv",
                source: "auto_map"
              }).onConflictDoNothing();
            } catch (e) {
              // Ignore alias errors
            }
          }
        }
      } else {
        // Ignore UUID names
        if (!/^[0-9a-f-]{36}$/.test(ex.name)) {
            console.log(`❌ NO MATCH: "${ex.name}"`);
        }
        failCount++;
      }
    }

    console.log(`\nResults:`);
    console.log(`Mapped: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Total: ${dbExercises.length}`);

  } catch (error) {
    console.error("Error during mapping:", error);
  } finally {
    process.exit(0);
  }
}

run();
