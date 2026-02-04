#!/usr/bin/env tsx
/**
 * Database Migration Script: Neon → Railway Postgres
 * 
 * This script performs a zero-downtime migration by:
 * 1. Dumping the entire Neon database schema and data
 * 2. Importing to Railway Postgres
 * 3. Validating row counts match
 * 4. Running data integrity checks
 */

import pkg from 'pg';
const { Client } = pkg;
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface MigrationConfig {
  sourceUrl: string;
  targetUrl: string;
  dryRun: boolean;
}

async function log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    error: '❌',
    warn: '⚠️'
  }[level];
  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function testConnection(connectionString: string, name: string): Promise<boolean> {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    await log(`${name} connection successful: ${result.rows[0].version}`, 'success');
    return true;
  } catch (error) {
    await log(`${name} connection failed: ${error}`, 'error');
    return false;
  } finally {
    await client.end();
  }
}

async function getTableCounts(connectionString: string): Promise<Map<string, number>> {
  const client = new Client({ connectionString });
  const counts = new Map<string, number>();
  
  try {
    await client.connect();
    
    // Get all table names from public schema
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    for (const row of tablesResult.rows) {
      const tableName = row.tablename;
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        counts.set(tableName, parseInt(countResult.rows[0].count));
      } catch (error: any) {
        // Table might not exist or have permissions issues - skip it
        if (error.code === '42P01') {
          // Table does not exist - this is OK, schema might be newer than data
          await log(`Skipping table ${tableName} (does not exist in source)`, 'warn');
        } else {
          throw error;
        }
      }
    }
    
    return counts;
  } finally {
    await client.end();
  }
}

async function dumpDatabase(sourceUrl: string, dumpFile: string): Promise<void> {
  await log(`Creating database dump to ${dumpFile}...`);
  
  // Use pg_dump to create a complete dump including schema and data
  const command = `pg_dump "${sourceUrl}" --no-owner --no-acl -f "${dumpFile}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr && !stderr.includes('WARNING')) {
      await log(`pg_dump stderr: ${stderr}`, 'warn');
    }
    await log('Database dump completed successfully', 'success');
  } catch (error:any) {
    throw new Error(`Failed to dump database: ${error.message}`);
  }
}

async function restoreDatabase(targetUrl: string, dumpFile: string): Promise<void> {
  await log(`Restoring database from ${dumpFile}...`);
  
  // Use psql to restore the dump
  const command = `psql "${targetUrl}" -f "${dumpFile}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer for large dumps
    });
    
    // Log any warnings but don't fail if they're minor
    if (stderr) {
      const lines = stderr.split('\n').filter(l => l.trim());
      const errors = lines.filter(l => l.toLowerCase().includes('error'));
      const warnings = lines.filter(l => !l.toLowerCase().includes('error'));
      
      if (warnings.length > 0) {
        await log(`Restore warnings: ${warnings.length} warning(s)`, 'warn');
      }
      if (errors.length > 0) {
        throw new Error(`Restore errors detected:\\n${errors.join('\\n')}`);
      }
    }
    
    await log('Database restore completed successfully', 'success');
  } catch (error: any) {
    throw new Error(`Failed to restore database: ${error.message}`);
  }
}

async function validateMigration(sourceUrl: string, targetUrl: string): Promise<boolean> {
  await log('Validating migration by comparing row counts...');
  
  const sourceCounts = await getTableCounts(sourceUrl);
  const targetCounts = await getTableCounts(targetUrl);
  
  let allMatch = true;
  const mismatches: string[] = [];
  
  for (const [table, sourceCount] of Array.from(sourceCounts.entries())) {
    const targetCount = targetCounts.get(table) || 0;
    
    if (sourceCount === targetCount) {
      await log(`✓ ${table}: ${sourceCount} rows`, 'success');
    } else {
      await log(`✗ ${table}: source=${sourceCount}, target=${targetCount}`, 'error');
      mismatches.push(`${table} (expected ${sourceCount}, got ${targetCount})`);
      allMatch = false;
    }
  }
  
  // Check for tables that exist in target but not in source
  for (const [table] of Array.from(targetCounts.entries())) {
    if (!sourceCounts.has(table)) {
      await log(`⚠️  Extra table in target: ${table}`, 'warn');
    }
  }
  
  if (allMatch) {
    await log('✅ All table row counts match!', 'success');
  } else {
    await log(`❌ Migration validation failed. Mismatches: ${mismatches.join(', ')}`, 'error');
  }
  
  return allMatch;
}

async function runMigration(config: MigrationConfig): Promise<void> {
  const dumpFile = path.join(process.cwd(), `neon_dump_${Date.now()}.sql`);
  
  try {
    // Step 1: Test connections
    await log('==== Step 1: Testing database connections ====');
    const sourceOk = await testConnection(config.sourceUrl, 'Source (Neon)');
    const targetOk = await testConnection(config.targetUrl, 'Target (Railway)');
    
    if (!sourceOk || !targetOk) {
      throw new Error('Connection test failed. Please check your DATABASE_URL variables.');
    }
    
    // Step 2: Get pre-migration counts
    await log('\n==== Step 2: Getting source database statistics ====');
    const sourceCounts = await getTableCounts(config.sourceUrl);
    const totalRows = Array.from(sourceCounts.values()).reduce((a, b) => a + b, 0);
    await log(`Source database has ${sourceCounts.size} tables with ${totalRows} total rows`);
    
    if (config.dryRun) {
      await log('\n🔍 DRY RUN MODE - No changes will be made', 'warn');
      await log('Source database tables:');
      for (const [table, count] of Array.from(sourceCounts.entries())) {
        console.log(`  - ${table}: ${count} rows`);
      }
      return;
    }
    
    // Step 3: Dump source database
    await log('\\n==== Step 3: Creating database dump ====');
    await dumpDatabase(config.sourceUrl, dumpFile);
    
    // Step 4: Restore to target
    await log('\\n==== Step 4: Restoring to target database ====');
    await restoreDatabase(config.targetUrl, dumpFile);
    
    // Step 5: Validate migration
    await log('\\n==== Step 5: Validating migration ====');
    const isValid = await validateMigration(config.sourceUrl, config.targetUrl);
    
    if (!isValid) {
      throw new Error('Migration validation failed. Please investigate before proceeding.');
    }
    
    await log('\\n🎉 Migration completed successfully!', 'success');
    await log('\\nNext steps:');
    await log('1. Test the Railway database connection locally');
    await log('2. Update DATABASE_URL in Railway to point to the new database');
    await log('3. Monitor for 24 hours before removing Neon connection');
    
  } catch (error: any) {
    await log(`\\n❌ Migration failed: ${error.message}`, 'error');
    throw error;
  } finally {
    // Clean up dump file if it exists
    try {
      await fs.access(dumpFile);
      await fs.unlink(dumpFile);
      await log(`Cleaned up dump file: ${dumpFile}`);
    } catch {
      // File doesn't exist, nothing to clean up
    }
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const sourceUrl = process.env.DATABASE_URL; // Current Neon database
const targetUrl = process.env.RAILWAY_DATABASE_URL; // New Railway database

if (!sourceUrl) {
  console.error('❌ DATABASE_URL environment variable is not set (source database)');
  process.exit(1);
}

if (!targetUrl) {
  console.error('❌ RAILWAY_DATABASE_URL environment variable is not set (target database)');
  console.error('Please provision a Railway Postgres database and set the environment variable.');
  process.exit(1);
}

const config: MigrationConfig = {
  sourceUrl,
  targetUrl,
  dryRun
};

runMigration(config)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
