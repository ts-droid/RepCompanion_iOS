/**
 * Seed script: Import exercises from CSV file and populate exercises table
 * 
 * Usage: tsx server/seed-csv-exercises.ts
 */

import { db } from './db';
import { exercises } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

interface CSVExercise {
  swedish: string;
  english: string;
  videoUrl: string;
  videoType: string;
}

/**
 * Extract video type from URL
 */
function getVideoType(url: string): string {
  if (!url) return 'video';
  if (url.includes('shorts')) return 'shorts';
  return 'video';
}

/**
 * Normalize exercise name for matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse CSV file
 */
function parseCSV(filePath: string): CSVExercise[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  const exercises: CSVExercise[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV with semicolon delimiter
    const parts = line.split(';').map(p => p.trim());
    
    if (parts.length >= 3) {
      const swedish = parts[0];
      const english = parts[1];
      const videoUrl = parts[2];
      const videoTypeRaw = parts[3];

      if (swedish && english && videoUrl) {
        exercises.push({
          swedish,
          english,
          videoUrl,
          videoType: videoTypeRaw || getVideoType(videoUrl),
        });
      }
    }
  }

  return exercises;
}

/**
 * Find exercise by name (tries both Swedish and English)
 */
async function findExerciseByName(swedish: string, english: string) {
  const normalizedSwedish = normalizeName(swedish);
  const normalizedEnglish = normalizeName(english);

  // Try to find by Swedish name
  let result = await db
    .select()
    .from(exercises)
    .where(
      or(
        eq(exercises.name, swedish),
        eq(exercises.nameEn, english)
      )
    )
    .limit(1);

  if (result.length > 0) return result[0];

  // Try fuzzy match on normalized names
  const allExercises = await db.select().from(exercises);
  
  for (const ex of allExercises) {
    const exSwedish = normalizeName(ex.name);
    const exEnglish = normalizeName(ex.nameEn || '');

    if (exSwedish === normalizedSwedish || exEnglish === normalizedEnglish) {
      return ex;
    }
  }

  return null;
}

async function seedCSVExercises() {
  console.log('📋 Starting CSV exercise seeding...\n');

  try {
    // Parse CSV
    const csvPath = path.join(process.cwd(), 'attached_assets', 'repcompanion-ovningar-2025-11-24_1764096710796.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found at ${csvPath}`);
      process.exit(1);
    }

    const csvExercises = parseCSV(csvPath);
    console.log(`✅ Parsed ${csvExercises.length} exercises from CSV\n`);

    let matchedCount = 0;
    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    const skipped: string[] = [];

    // Process each exercise
    for (const csvEx of csvExercises) {
      try {
        const existing = await findExerciseByName(csvEx.swedish, csvEx.english);

        if (existing) {
          // Update existing exercise
          if (existing.youtubeUrl !== csvEx.videoUrl) {
            await db
              .update(exercises)
              .set({
                youtubeUrl: csvEx.videoUrl,
                videoType: csvEx.videoType,
              })
              .where(eq(exercises.id, existing.id));
            
            updatedCount++;
            console.log(`✏️  Updated: ${existing.name} (${csvEx.english})`);
          } else {
            matchedCount++;
          }
        } else {
          // Create new exercise
          await db.insert(exercises).values({
            name: csvEx.swedish,
            nameEn: csvEx.english,
            youtubeUrl: csvEx.videoUrl,
            videoType: csvEx.videoType,
            category: 'general',
            difficulty: 'intermediate',
            primaryMuscles: [],
            requiredEquipment: [],
          });
          
          createdCount++;
          console.log(`✨ Created: ${csvEx.swedish} (${csvEx.english})`);
        }
      } catch (error) {
        skippedCount++;
        skipped.push(`${csvEx.swedish} (${csvEx.english}): ${error}`);
        console.error(`⚠️  Skipped: ${csvEx.swedish} - ${error}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTS:');
    console.log(`  Matched (no update needed): ${matchedCount}`);
    console.log(`  Updated with new videos: ${updatedCount}`);
    console.log(`  Created new exercises: ${createdCount}`);
    console.log(`  Skipped/Errors: ${skippedCount}`);
    console.log(`  Total processed: ${matchedCount + updatedCount + createdCount + skippedCount}/${csvExercises.length}`);
    console.log('='.repeat(60) + '\n');

    if (skipped.length > 0) {
      console.log('⚠️  Skipped exercises:');
      skipped.forEach(s => console.log(`   - ${s}`));
    }

  } catch (error) {
    console.error('❌ Error seeding exercises:', error);
    process.exit(1);
  }
}

export { seedCSVExercises };

// Run if called directly
seedCSVExercises()
  .then(() => {
    console.log('✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
