import { db } from "../server/db";
import { exercises, equipmentCatalog } from "../shared/schema";
import { eq, sql } from "drizzle-orm";

const muscleMap: Record<string, string> = {
  "Bröst": "chest",
  "Rygg": "back",
  "Axlar": "shoulders",
  "Triceps": "triceps",
  "Biceps": "biceps",
  "Ben": "legs",
  "Mage": "abs",
  "Core": "core",
  "Gluteus": "glutes",
  "Baksida lår": "hamstrings",
  "Framsida lår": "quads",
  "Vader": "calves",
  "Underarmar": "forearms",
  "Nedre rygg": "lower back",
  "Övre rygg": "upper back",
  "Trapzius": "traps",
  "Latissimus dorsi": "lats",
  "Främre deltoider": "front deltoids",
  "Mellersta deltoider": "middle deltoids",
  "Bakre deltoider": "rear deltoids",
  "Övrigt": "other",
  "Hela kroppen": "full body",
  "Hjärt-lung": "cardio",
  "Överarmsmuskler": "arm muscles",
  "Övre bröst": "upper chest"
};

const equipmentMap: Record<string, string> = {
  "Skivstång": "barbell",
  "Hantel": "dumbbell",
  "Bänk": "bench",
  "Justerbar bänk": "adjustable bench",
  "Kabelmaskin": "cable machine",
  "Smithmaskin": "smith machine",
  "Kettlebell": "kettlebell",
  "Gummiband": "resistance band",
  "Egen kroppsvikt": "bodyweight",
  "Pull-up stång": "pull-up bar",
  "Dippställning": "dip station",
  "Benpressmaskin": "leg press machine",
  "Latsdragsmaskin": "lat pulldown machine",
  "Bensparkmaskin": "leg extension machine",
  "Bencurlmaskin": "leg curl machine",
  "Maskin": "machine",
  "Ställning": "rack",
  "Skivstång och bänk": "barbell and bench",
  "Hantlar": "dumbbells",
};

async function migrate() {
  console.log("Starting localization migration...");

  // 1. Migrate exercises
  const allExercises = await db.select().from(exercises);
  for (const ex of allExercises) {
    let changed = false;
    const updates: any = {};

    if (ex.primaryMuscles) {
      const newMuscles = ex.primaryMuscles.map(m => muscleMap[m] || m.toLowerCase());
      if (JSON.stringify(newMuscles) !== JSON.stringify(ex.primaryMuscles)) {
        updates.primaryMuscles = newMuscles;
        changed = true;
      }
    }

    if (ex.secondaryMuscles) {
      const newMuscles = ex.secondaryMuscles.map(m => muscleMap[m] || m.toLowerCase());
      if (JSON.stringify(newMuscles) !== JSON.stringify(ex.secondaryMuscles)) {
        updates.secondaryMuscles = newMuscles;
        changed = true;
      }
    }

    if (ex.requiredEquipment) {
      const newEq = ex.requiredEquipment.map(e => equipmentMap[e] || e.toLowerCase());
      if (JSON.stringify(newEq) !== JSON.stringify(ex.requiredEquipment)) {
        updates.requiredEquipment = newEq;
        changed = true;
      }
    }

    if (changed) {
      console.log(`Updating exercise: ${ex.name} -> ${JSON.stringify(updates)}`);
      await db.update(exercises).set(updates).where(eq(exercises.id, ex.id));
    }
  }

  // 2. Migrate equipment catalog
  const allEquipment = await db.select().from(equipmentCatalog);
  for (const eqCat of allEquipment) {
    if (eqCat.name && equipmentMap[eqCat.name]) {
      const newNameEn = eqCat.nameEn || equipmentMap[eqCat.name];
      console.log(`Updating equipment: ${eqCat.name} -> nameEn: ${newNameEn}`);
      await db.update(equipmentCatalog)
        .set({ nameEn: newNameEn })
        .where(eq(equipmentCatalog.id, eqCat.id));
    }
  }

  console.log("Migration complete!");
  process.exit(0);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
