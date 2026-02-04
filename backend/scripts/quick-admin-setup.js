#!/usr/bin/env node
/**
 * Quick script to create admin_users table on Railway
 */

import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const sql = fs.readFileSync('./migrations/0007_create_admin_users.sql', 'utf8');

async function createTable() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    await client.query(sql);
    console.log('✅ Created admin_users table');
    
    // Seed admin user
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.hash('qwerty123456', 10);
    
    await client.query(
      `INSERT INTO admin_users (email, password_hash, force_password_change, is_super_admin, totp_enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      ['thomas@recompute.it', hash, true, true, false]
    );
    
    console.log('✅ Created default admin user');
    console.log('   Email: thomas@recompute.it');
    console.log('   Password: qwerty123456');
    
  } catch (error) {
    console.error('❌ Error:', error .message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createTable();
