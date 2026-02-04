import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const PROJECT_ROOT = process.cwd();
const SCHEMA_PATH = path.join(PROJECT_ROOT, 'shared', 'schema.ts');

function log(msg) {
  console.log(`[DB-BACKUP] ${new Date().toISOString()}: ${msg}`);
}

async function runBackup() {
  try {
    log('Schema change detected. Generating migrations...');
    
    // 1. Generate migrations
    // Use a dummy DATABASE_URL if not provided to allow generation
    const env = { ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'postgres://dummy:dummy@localhost:5432/dummy' };
    execSync('npm run db:generate', { stdio: 'inherit', env });

    // 2. Check if there are changes in migrations/ or shared/schema.ts
    const status = execSync('git status --porcelain migrations/ shared/schema.ts').toString().trim();
    
    if (status) {
      log('Changes detected in migrations or schema. Committing and pushing...');
      
      // 3. Git commit
      execSync('git add migrations/ shared/schema.ts');
      const timestamp = new Date().toLocaleString();
      execSync(`git commit -m "Auto-backup: DB Schema update - ${timestamp}"`);
      
      // 4. Git push
      // We try to push to the current branch to origin
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
      log(`Pushing to origin/${currentBranch}...`);
      execSync(`git push origin ${currentBranch}`);
      
      log('✅ Backup successfully pushed to GitHub!');
    } else {
      log('No changes detected in migrations. Skipping backup.');
    }
  } catch (error) {
    log(`❌ Error during backup: ${error.message}`);
  }
}

runBackup();
