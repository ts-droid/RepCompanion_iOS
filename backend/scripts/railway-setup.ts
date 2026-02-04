#!/usr/bin/env node
/**
 * Run migrations and seed on Railway using production environment
 * This script should be run once after deployment to set up the database
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { adminUsers } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function runSetup() {
  console.log('[RAILWAY-SETUP] 🚀 Starting database setup...');
  
  if (!process.env.DATABASE_URL) {
    console.error('[RAILWAY-SETUP] ❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    // Step 1: Run migrations using node-postgres
    console.log('[RAILWAY-SETUP] 📂 Running migrations...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('[RAILWAY-SETUP] ✅ Migrations completed!');

    // Step 2: Seed default admin
    console.log('[RAILWAY-SETUP] 🌱 Checking for default admin...');
    const defaultEmail = "thomas@recompute.it";
    
    const [existing] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, defaultEmail));
    
    if (existing) {
      console.log(`[RAILWAY-SETUP] ℹ️  Admin user ${defaultEmail} already exists`);
    } else {
      console.log('[RAILWAY-SETUP] Creating default admin user...');
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash("qwerty123456", 10);
      
      await db.insert(adminUsers).values({
        email: defaultEmail,
        passwordHash,
        forcePasswordChange: true,
        isSuperAdmin: true,
        totpEnabled: false,
      });
      
      console.log('[RAILWAY-SETUP] ✅ Default admin created!');
      console.log(`[RAILWAY-SETUP] Email: ${defaultEmail}`);
      console.log('[RAILWAY-SETUP] Password: qwerty123456 (must change on first login)');
    }

    console.log('\n[RAILWAY-SETUP] 🎉 Setup completed successfully!');
    console.log('[RAILWAY-SETUP] Admin login: https://repcompanionserver-production.up.railway.app/admin/login');
    process.exit(0);
    
  } catch (error) {
    console.error('[RAILWAY-SETUP] ❌ Setup failed:', error);
    process.exit(1);
  }
}

runSetup();
