#!/usr/bin/env node
/**
 * Run database migrations programmatically
 * This is more reliable than drizzle-kit migrate in production
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { migrate } from 'drizzle-orm/neon-http/migrator';


async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.error('[MIGRATE] ❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('[MIGRATE] 🔄 Starting database migrations...');
  
  try {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);
    
    console.log('[MIGRATE] 📂 Reading migrations from ./migrations');
    
    await migrate(db, { migrationsFolder: './migrations' });
    
    console.log('[MIGRATE] ✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATE] ❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
