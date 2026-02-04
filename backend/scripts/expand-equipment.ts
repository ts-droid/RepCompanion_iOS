
import pkg from 'pg';
const { Client } = pkg;

// List of standard equipment to seed
const EQUIPMENT_LIST = [
  // Free Weights
  { name: 'EZ-Bar', name_en: 'EZ-Bar', category: 'free_weights', type: 'barbell' },
  { name: 'Kettlebell', name_en: 'Kettlebell', category: 'free_weights', type: 'dumbbell' },
  { name: 'Hex Bar / Trap Bar', name_en: 'Trap Bar', category: 'free_weights', type: 'barbell' },
  { name: 'Safety Squat Bar', name_en: 'Safety Squat Bar', category: 'free_weights', type: 'barbell' },
  { name: 'Swiss Bar / Football Bar', name_en: 'Swiss Bar', category: 'free_weights', type: 'barbell' },
  { name: 'Viktskiva', name_en: 'Weight Plate', category: 'free_weights', type: 'accessory' },
  
  // Machines
  { name: 'Lårcurl (Sittande)', name_en: 'Seated Leg Curl', category: 'machine', type: 'isolation' },
  { name: 'Lårcurl (Liggande)', name_en: 'Lying Leg Curl', category: 'machine', type: 'isolation' },
  { name: 'Benspark', name_en: 'Leg Extension', category: 'machine', type: 'isolation' },
  { name: 'Benpress', name_en: 'Leg Press', category: 'machine', type: 'compound' },
  { name: 'Hack Squat', name_en: 'Hack Squat', category: 'machine', type: 'compound' },
  { name: 'Smith-maskin', name_en: 'Smith Machine', category: 'machine', type: 'compound' },
  { name: 'Kabelmaskin (Kryssdrag)', name_en: 'Cable Crossover', category: 'machine', type: 'cable' },
  { name: 'Latsdrag', name_en: 'Lat Pulldown', category: 'machine', type: 'cable' },
  { name: 'Sittande Rodd', name_en: 'Seated Cable Row', category: 'machine', type: 'cable' },
  { name: 'Assault Bike', name_en: 'Assault Bike', category: 'cardio', type: 'bike' },
  { name: 'Roddmaskin', name_en: 'Rowing Machine', category: 'cardio', type: 'rower' },
  { name: 'SkiErg', name_en: 'SkiErg', category: 'cardio', type: 'skierg' },
  { name: 'Löpband', name_en: 'Treadmill', category: 'cardio', type: 'treadmill' },
  { name: 'Trappmaskin', name_en: 'Stairmaster', category: 'cardio', type: 'stairs' },

  // Bodyweight / Calisthenics
  { name: 'Romerska Ringar', name_en: 'Gymnastic Rings', category: 'bodyweight', type: 'rings' },
  { name: 'Parallettes', name_en: 'Parallettes', category: 'bodyweight', type: 'bars' },
  { name: 'Chinsräcke', name_en: 'Pull-up Bar', category: 'bodyweight', type: 'bar' },
  { name: 'Dipsställning', name_en: 'Dip Station', category: 'bodyweight', type: 'station' },

  // Accessories
  { name: 'Gummiband (Långa)', name_en: 'Resistance Bands (Long)', category: 'accessory', type: 'band' },
  { name: 'Miniband', name_en: 'Mini Bands', category: 'accessory', type: 'band' },
  { name: 'Pilatesboll', name_en: 'Swiss Ball', category: 'accessory', type: 'ball' },
  { name: 'Medicinboll', name_en: 'Medicine Ball', category: 'accessory', type: 'ball' },
  { name: 'Slam Ball', name_en: 'Slam Ball', category: 'accessory', type: 'ball' },
  { name: 'Box (Plyobox)', name_en: 'Plyo Box', category: 'accessory', type: 'box' },
  { name: 'Landmine', name_en: 'Landmine Attachment', category: 'accessory', type: 'attachment' },
  { name: 'Ab Wheel', name_en: 'Ab Wheel', category: 'accessory', type: 'wheel' },
  { name: 'Viktbälte', name_en: 'Dip Belt', category: 'accessory', type: 'belt' }
];

async function log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const prefix = { info: '📋', success: '✅', error: '❌', warn: '⚠️' }[level];
  console.log(`${prefix} ${message}`);
}

async function run(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await log('Connected to database', 'success');

    let addedCount = 0;

    for (const item of EQUIPMENT_LIST) {
        // Generate a deterministic key if possible or let DB default
        const key = item.name_en.toLowerCase().replace(/[^a-z0-9]/g, '_');

        await client.query(`
            INSERT INTO equipment_catalog (
                name, name_en, equipment_key, category, type, description
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (name) DO NOTHING
        `, [
            item.name, item.name_en, key, item.category, item.type, `Standard ${item.name_en}`
        ]);
        
        // Check if inserted? (Simplification: just count iterations provided no error thrown)
        addedCount++;
    }

    await log(`Process complete. Seeded potential ${addedCount} items (duplicates ignored).`, 'success');

  } catch (error: any) {
    await log(`Error: ${error.message}`, 'error');
    process.exit(1);
  } finally {
    await client.end();
  }
}

const databaseUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ No database URL found.');
  process.exit(1);
}
run(databaseUrl);
