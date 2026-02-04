
import { db } from '../server/db';
import { unmappedExercises } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Same normalization logic as in exercise-matcher.ts
function normalizeMetadataValue(val: string): string {
  if (!val) return val;
  
  const MAPPINGS: Record<string, string> = {
    // Categories
    'push_horizontal': 'Push (Horizontal)',
    'push_vertical': 'Push (Vertical)',
    'pull_horizontal': 'Pull (Horizontal)',
    'pull_vertical': 'Pull (Vertical)', 
    'legs_squat': 'Ben (Knäböj)',
    'legs_hinge': 'Ben (Höftfällning)',
    'isolation_arms': 'Armar (Isolation)',
    'isolation_shoulders': 'Axlar (Isolation)',
    'isolation_legs': 'Ben (Isolation)',
    'core': 'Bål',
    'cardio': 'Kondition',
    
    // Equipment
    'dumbbell': 'Hantlar',
    'dumbbells': 'Hantlar',
    'barbell': 'Skivstång',
    'cable': 'Kabelmaskin',
    'machine': 'Maskin',
    'bodyweight': 'Kroppsvikt',
    'band': 'Gummiband',
    'kettlebell': 'Kettlebell',
    'bench': 'Träningsbänk',
    'rack': 'Skivstångsställning',
    'pull-up bar': 'Chinsräcke',
    'smith machine': 'Smithmaskin',
    'rower': 'Roddmaskin'
  };
  
  const lower = val.toLowerCase();
  if (MAPPINGS[lower]) return MAPPINGS[lower];
  
  // Fallback: Title Case and replace underscores
  return val.replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
}

async function enrich() {
  console.log('Fetching unmapped exercises...');
  const allUnmapped = await db.select().from(unmappedExercises);
  console.log(`Found ${allUnmapped.length} entries.`);

  let updatedCount = 0;

  for (const entry of allUnmapped) {
    const newCategory = entry.category ? normalizeMetadataValue(entry.category) : null;
    const newEquipment = entry.equipment ? entry.equipment.map(normalizeMetadataValue) : null;
    const newPrimary = entry.primaryMuscles ? entry.primaryMuscles.map(normalizeMetadataValue) : null;
    const newSecondary = entry.secondaryMuscles ? entry.secondaryMuscles.map(normalizeMetadataValue) : null;
    const newDifficulty = entry.difficulty ? normalizeMetadataValue(entry.difficulty) : null;

    // Check if anything actually changed
    const changed = 
      newCategory !== entry.category ||
      JSON.stringify(newEquipment) !== JSON.stringify(entry.equipment) ||
      JSON.stringify(newPrimary) !== JSON.stringify(entry.primaryMuscles) ||
      JSON.stringify(newSecondary) !== JSON.stringify(entry.secondaryMuscles) ||
      newDifficulty !== entry.difficulty;

    if (changed) {
      await db.update(unmappedExercises)
        .set({
          category: newCategory,
          equipment: newEquipment,
          primaryMuscles: newPrimary,
          secondaryMuscles: newSecondary,
          difficulty: newDifficulty
        })
        .where(eq(unmappedExercises.id, entry.id));
      
      updatedCount++;
      // console.log(`Updated ${entry.aiName}`);
    }
  }

  console.log(`✅ Enrichment complete. Updated ${updatedCount} entries.`);
}

enrich().catch(console.error);
