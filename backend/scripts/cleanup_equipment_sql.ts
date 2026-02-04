
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

// Simple .env parser
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf-8');
  envConfig.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value && !process.env[key.trim()]) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    const client = await pool.connect();
    console.log('Connected to DB');

    // 1. Move Roddmaskin to Cardio
    console.log('Updating Categories...');
    await client.query(`
      UPDATE equipment_catalog 
      SET category = 'cardio' 
      WHERE name ILIKE '%Roddmaskin%' OR name ILIKE '%Rowing%'
    `);
    
    // Fix casing for categories
    await client.query("UPDATE equipment_catalog SET category = 'cardio' WHERE category = 'Cardio'");
    await client.query("UPDATE equipment_catalog SET category = 'machine' WHERE category = 'Machine'");
    await client.query("UPDATE equipment_catalog SET category = 'free_weights' WHERE category = 'Free Weights'");
    await client.query("UPDATE equipment_catalog SET category = 'bodyweight' WHERE category = 'Bodyweight'");
    await client.query("UPDATE equipment_catalog SET category = 'accessory' WHERE category = 'Accessory'");


    // 2. Dedup Logic
    // Pairs: [Duplicate Name, Keep Key]
    const duplicates = [
      { name: 'Smithmaskin', keepKey: 'smith_machine' },
      { name: 'Latmaskin', keepKey: 'lat_pulldown' },
      { name: 'Kabelmaskin', keepKey: 'cable_machine' },
      { name: 'Lårcurl (Sittande)', keepKey: 'leg_curl_seated' },
      { name: 'Lårcurl (Liggande)', keepKey: 'leg_curl_lying' }, // Might want to keep both if keys differ, but if duplicate name exists without key...
      // Check for generic "Lårcurl" if it exists?
    ];

    for (const dup of duplicates) {
        // Find the "Keeper"
        const keepRes = await client.query('SELECT id, name FROM equipment_catalog WHERE equipment_key = $1', [dup.keepKey]);
        if (keepRes.rows.length === 0) {
            console.log(`Skipping ${dup.name}: Keeper record with key ${dup.keepKey} not found.`);
            continue;
        }
        const keeper = keepRes.rows[0];

        // Find the "Trash" (Duplicate by name, NO key or different key)
        const trashRes = await client.query('SELECT id, name FROM equipment_catalog WHERE name = $1 AND (equipment_key IS NULL OR equipment_key != $2)', [dup.name, dup.keepKey]);
        
        for (const trash of trashRes.rows) {
            console.log(`Merging ${trash.name} (${trash.id}) into ${keeper.name} (${keeper.id})...`);
            
            try {
                // Delete the trash item
                await client.query('DELETE FROM equipment_catalog WHERE id = $1', [trash.id]);
                console.log(`Deleted ${trash.name}`);
            } catch (err) {
                console.error(`Failed to delete ${trash.name}:`, err.message);
            }
        }
    }

    console.log('Cleanup Complete.');

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
