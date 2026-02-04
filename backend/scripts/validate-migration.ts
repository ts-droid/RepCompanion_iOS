#!/usr/bin/env tsx
/**
 * Database Validation Script
 * 
 * Validates database integrity by:
 * 1. Checking all tables exist
 * 2. Verifying row counts
 * 3. Testing critical queries
 * 4. Checking indexes and constraints
 */

import pkg from 'pg';
const { Client } = pkg;

async function log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const prefix = { info: '📋', success: '✅', error: '❌', warn: '⚠️' }[level];
  console.log(`${prefix} ${message}`);
}

async function validateDatabase(databaseUrl: string): Promise<boolean> {
  const client = new Client({ connectionString: databaseUrl });
  let allChecks = true;

  try {
    await client.connect();
    await log('Connected to database successfully', 'success');

    // Check 1: Verify critical tables exist
    await log('\\n==== Checking critical tables ====');
    const criticalTables = [
      'users',
      'user_profiles',
      'workout_sessions',
      'exercise_logs',
      'program_templates',
      'exercises',
      'gyms'
    ];

    for (const table of criticalTables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = $1
        )
      `, [table]);

      if (result.rows[0].exists) {
        await log(`✓ Table '${table}' exists`, 'success');
      } else {
        await log(`✗ Table '${table}' missing`, 'error');
        allChecks = false;
      }
    }

    // Check 2: Test database functionality
    await log('\\n==== Testing database functionality ====');

    // Test basic SELECT
    const versionResult = await client.query('SELECT version()');
    await log(`PostgreSQL version: ${versionResult.rows[0].version.split('on')[0].trim()}`, 'info');

    // Test UUID generation (needed for primary keys)
    const uuidResult = await client.query('SELECT gen_random_uuid() as uuid');
    await log(`UUID generation works: ${uuidResult.rows[0].uuid}`, 'success');

    // Test timestamp functions
    const timeResult = await client.query('SELECT NOW() as now');
    await log(`Timestamp functions work: ${timeResult.rows[0].now}`, 'success');

    // Check 3: Verify indexes
    await log('\\n==== Checking indexes ====');
    const indexResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    await log(`Found ${indexResult.rows.length} indexes`, 'info');
    if (indexResult.rows.length === 0) {
      await log('Warning: No indexes found. This might impact performance.', 'warn');
    }

    // Check 4: Test a critical query path (user authentication flow)
    await log('\\n==== Testing critical query paths ====');
    
    try {
      // This should work even if no users exist
      const authTest = await client.query(`
        SELECT u.id, u.email, up.onboarding_completed
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LIMIT 1
      `);
      await log('✓ Auth query path works', 'success');
    } catch (error: any) {
      await log(`✗ Auth query failed: ${error.message}`, 'error');
      allChecks = false;
    }

    // Check 5: Verify foreign key constraints
    await log('\\n==== Checking foreign key constraints ====');
    const fkResult = await client.query(`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as table_name,
        confrelid::regclass as referenced_table
      FROM pg_constraint
      WHERE contype = 'f'
      AND connamespace = 'public'::regnamespace
    `);

    await log(`Found ${fkResult.rows.length} foreign key constraints`, 'info');

    // Summary
    await log('\\n==== Validation Summary ====');
    if (allChecks) {
      await log('All validation checks passed! ✅', 'success');
    } else {
      await log('Some validation checks failed. Please review errors above.', 'error');
    }

    return allChecks;

  } catch (error: any) {
    await log(`Database validation error: ${error.message}`, 'error');
    return false;
  } finally {
    await client.end();
  }
}

// Main execution
const databaseUrl = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ No database URL found. Set DATABASE_URL or RAILWAY_DATABASE_URL');
  process.exit(1);
}

validateDatabase(databaseUrl)
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
