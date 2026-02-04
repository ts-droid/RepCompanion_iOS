#!/usr/bin/env node
/**
 * Seed default admin user only (Skip migrations if they exist)
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { adminUsers } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function seedAdmin() {
  console.log('[SEED-ADMIN] 🌱 Starting admin seed...');
  
  if (!process.env.DATABASE_URL) {
    console.error('[SEED-ADMIN] ❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const db = drizzle(pool);
    
    const defaultEmail = "thomas@recompute.it";
    
    console.log('[SEED-ADMIN] Checking if admin exists...');
    const [existing] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, defaultEmail));
    
    if (existing) {
      console.log(`[SEED-ADMIN] ℹ️  Admin user ${defaultEmail} already exists`);
      console.log(`[SEED-ADMIN] Super Admin: ${existing.isSuperAdmin}`);
      console.log(`[SEED-ADMIN] 2FA Enabled: ${existing.totpEnabled}`);
    } else {
      console.log('[SEED-ADMIN] Creating default admin user...');
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash("qwerty123456", 10);
      
      await db.insert(adminUsers).values({
        email: defaultEmail,
        passwordHash,
        forcePasswordChange: true,
        isSuperAdmin: true,
        totpEnabled: false,
      });
      
      console.log('[SEED-ADMIN] ✅ Default admin created!');
      console.log(`[SEED-ADMIN] Email: ${defaultEmail}`);
      console.log('[SEED-ADMIN] Password: qwerty123456 (must change on first login)');
    }

    console.log('\n[SEED-ADMIN] 🎉 Seed completed!');
    console.log('[SEED-ADMIN] Admin login: https://repcompanionserver-production.up.railway.app/admin/login');
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    console.error('[SEED-ADMIN] ❌ Seed failed:', error);
    process.exit(1);
  }
}

seedAdmin();
