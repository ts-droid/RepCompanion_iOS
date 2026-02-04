import { db } from './db';
import { exercises } from '@shared/schema';
import { eq, or } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

interface JsonExercise {
  exercise_id: string;
  name_sv: string;
  name_en: string;
  equipment: string;
  muscle_groups: string[];
  categories: string[];
  gender_specialization: string;
  requires_1RM: boolean;
  good_for_beginners: boolean;
  core_engagement: boolean;
  ai_aliases: string[];
  training_level_priority: string[];
  equipment_mapping_tags: string[];
}

function determineDifficulty(ex: JsonExercise): string {
  if (ex.good_for_beginners && ex.training_level_priority?.includes('beginner')) {
    return 'beginner';
  } else if (ex.requires_1RM || !ex.training_level_priority?.includes('beginner')) {
    return 'advanced';
  }
  return 'intermediate';
}

function determineCategory(categories: string[]): string {
  if (categories?.includes('rehabilitation')) return 'rehabilitation';
  if (categories?.includes('cardio')) return 'cardio';
  return 'strength';
}

function isCompound(muscleGroups: string[]): boolean {
  return muscleGroups.length > 1;
}

async function syncExercises() {
  console.log('Starting exercise sync from JSON...\n');
  
  const jsonPath = path.join(process.cwd(), 'attached_assets', 'Pasted--exercise-id-EX001-name-sv-Armh-vningar-name-en-Push-ups-equ-1764167695607_1764167695608.txt');
  
  if (!fs.existsSync(jsonPath)) {
    console.error('JSON file not found:', jsonPath);
    process.exit(1);
  }
  
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const jsonExercises: JsonExercise[] = JSON.parse(jsonContent);
  
  console.log(`Loaded ${jsonExercises.length} exercises from JSON\n`);
  
  const existingExercises = await db.select().from(exercises);
  console.log(`Found ${existingExercises.length} existing exercises in database\n`);
  
  const existingByNameSv = new Map(existingExercises.map(e => [e.name.toLowerCase().trim(), e]));
  const existingByNameEn = new Map(existingExercises.filter(e => e.nameEn).map(e => [e.nameEn!.toLowerCase().trim(), e]));
  
  let updated = 0;
  let inserted = 0;
  let videoPreserved = 0;
  
  for (const jsonEx of jsonExercises) {
    const nameSvLower = jsonEx.name_sv.toLowerCase().trim();
    const nameEnLower = jsonEx.name_en.toLowerCase().trim();
    
    let existingEx = existingByNameSv.get(nameSvLower) || existingByNameEn.get(nameEnLower);
    
    const exerciseData = {
      exerciseId: jsonEx.exercise_id,
      name: jsonEx.name_sv,
      nameEn: jsonEx.name_en,
      category: determineCategory(jsonEx.categories),
      difficulty: determineDifficulty(jsonEx),
      primaryMuscles: jsonEx.muscle_groups,
      secondaryMuscles: [],
      requiredEquipment: [jsonEx.equipment],
      isCompound: isCompound(jsonEx.muscle_groups),
      requires1RM: jsonEx.requires_1RM,
      goodForBeginners: jsonEx.good_for_beginners,
      coreEngagement: jsonEx.core_engagement,
      genderSpecialization: jsonEx.gender_specialization,
      categories: jsonEx.categories,
      aiSearchTerms: jsonEx.ai_aliases,
      trainingLevelPriority: jsonEx.training_level_priority,
      equipmentMappingTags: jsonEx.equipment_mapping_tags,
    };
    
    if (existingEx) {
      const updateData: any = { ...exerciseData };
      
      if (existingEx.youtubeUrl) {
        updateData.youtubeUrl = existingEx.youtubeUrl;
        updateData.videoType = existingEx.videoType;
        videoPreserved++;
      }
      if (existingEx.instructions) {
        updateData.instructions = existingEx.instructions;
      }
      if (existingEx.description) {
        updateData.description = existingEx.description;
      }
      
      await db.update(exercises)
        .set(updateData)
        .where(eq(exercises.id, existingEx.id));
      
      updated++;
      console.log(`Updated: ${jsonEx.name_sv} (${jsonEx.exercise_id})${existingEx.youtubeUrl ? ' [video preserved]' : ''}`);
    } else {
      await db.insert(exercises).values(exerciseData);
      inserted++;
      console.log(`Inserted: ${jsonEx.name_sv} (${jsonEx.exercise_id})`);
    }
  }
  
  console.log('\n========== SYNC COMPLETE ==========');
  console.log(`Total processed: ${jsonExercises.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Video links preserved: ${videoPreserved}`);
  
  const finalCount = await db.select().from(exercises);
  console.log(`\nFinal exercise count: ${finalCount.length}`);
  
  const withVideos = finalCount.filter(e => e.youtubeUrl);
  console.log(`Exercises with video links: ${withVideos.length}`);
  
  const withNewFields = finalCount.filter(e => e.trainingLevelPriority && e.trainingLevelPriority.length > 0);
  console.log(`Exercises with training_level_priority: ${withNewFields.length}`);
  
  process.exit(0);
}

syncExercises().catch(console.error);
