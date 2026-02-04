import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '../shared/schema.js';
import * as fs from 'fs';

// Railway database connection from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable not set");
  console.error("Please run: export DATABASE_URL='your-database-url'");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function exportTablesToCSV() {
  console.log("Connecting to Railway database...");
  
  // Export exercises
  const exercises = await db.select().from(schema.exercises).orderBy(schema.exercises.name);
  exportToCSV(exercises, 'exercises', [
    'id', 'exerciseId', 'name', 'nameEn', 'category', 'difficulty',
    'primaryMuscles', 'secondaryMuscles', 'requiredEquipment', 'movementPattern',
    'isCompound', 'youtubeUrl', 'videoType', 'requires1RM', 'goodForBeginners',
    'coreEngagement', 'genderSpecialization', 'categories', 'aiSearchTerms',
    'trainingLevelPriority', 'equipmentMappingTags', 'instructions', 'description'
  ]);
  
  // Export equipment_catalog
  const equipmentCatalog = await db.select().from(schema.equipmentCatalog).orderBy(schema.equipmentCatalog.name);
  exportToCSV(equipmentCatalog, 'equipment_catalog', [
    'id', 'name', 'category', 'description', 'createdAt', 'updatedAt'
  ]);
  
  // Export user_profiles
  const userProfiles = await db.select().from(schema.userProfiles);
  exportToCSV(userProfiles, 'user_profiles', [
    'id', 'userId', 'age', 'sex', 'bodyWeight', 'height', 'trainingLevel',
    'motivationType', 'goalStrength', 'goalVolume', 'goalEndurance', 'goalCardio',
    'sessionsPerWeek', 'sessionDuration', 'onboardingCompleted', 'equipmentRegistered',
    'selectedGymId', 'theme', 'createdAt', 'updatedAt'
  ]);
  
  // Export gyms
  const gyms = await db.select().from(schema.gyms);
  exportToCSV(gyms, 'gyms', [
    'id', 'userId', 'name', 'location', 'isActive', 'createdAt', 'updatedAt'
  ]);
  
  // Export user_equipment
  const userEquipment = await db.select().from(schema.userEquipment);
  exportToCSV(userEquipment, 'user_equipment', [
    'id', 'userId', 'gymId', 'equipmentId', 'equipmentName', 'createdAt'
  ]);
  
  // Export program_templates
  const programTemplates = await db.select().from(schema.programTemplates);
  exportToCSV(programTemplates, 'program_templates', [
    'id', 'userId', 'name', 'description', 'sessionsPerWeek', 'durationWeeks',
    'focusArea', 'difficulty', 'isActive', 'createdAt', 'updatedAt'
  ]);
  
  await pool.end();
  console.log("\\nExport complete! Check the current directory for CSV files.");
}

function exportToCSV(data: any[], tableName: string, columns: string[]) {
  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return "";
    const str = Array.isArray(val) ? val.join("; ") : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\\n")) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  
  const headers = columns.join(",");
  const rows = data.map(row => 
    columns.map(col => escapeCSV(row[col])).join(",")
  );
  
  const csv = [headers, ...rows].join("\\n");
  const filename = `${tableName}_export.csv`;
  fs.writeFileSync(filename, csv, "utf-8");
  console.log(`✅ Exported ${data.length} rows to ${filename}`);
}

exportTablesToCSV().catch(console.error);
