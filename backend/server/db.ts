import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let databaseUrl = process.env.DATABASE_URL;

// Sanitize connection string if it was copied as a 'psql' command
// Regex matches and extracts anything that looks like a postgresql URL
const urlMatch = databaseUrl.match(/postgresql:\/\/[^\s']+/);
if (urlMatch) {
  databaseUrl = urlMatch[0];
}

// Log anonymized URL for debugging
const anonymizedUrl = databaseUrl.replace(/:[^:@]+@/, ":****@");
console.log(`[DB] Initializing connection to: ${anonymizedUrl}`);

// Create PostgreSQL connection pool with production-optimized settings
const pool = new Pool({
  connectionString: databaseUrl,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection cannot be established
  ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

// Handle pool errors to prevent crashes
pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

export const db = drizzle(pool, { schema });
