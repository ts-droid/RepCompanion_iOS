
import pkg from 'pg';
const { Pool } = pkg;
// Manually load env if needed, or rely on system env. 
// Assuming running with `source .env && npx tsx ...` or just `npx tsx ...` if env is set.
// But better to allow loading .env
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
    const res = await pool.query('SELECT * FROM equipment_catalog ORDER BY category, name');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

run();
