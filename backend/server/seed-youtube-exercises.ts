/**
 * Seed script: Fetch exercises from @DeltaBolic YouTube channel
 * and populate exercises table with video URLs
 * 
 * Usage: tsx server/seed-youtube-exercises.ts
 */

import { db } from './db';
import { exercises } from '@shared/schema';
import { youtubeService } from './youtube-service';
import { eq } from 'drizzle-orm';

interface ExerciseMapping {
  swedish: string;
  english: string;
  videoKeywords?: string[]; // Alternative keywords for fuzzy matching
}

// Common exercise mappings (Swedish → English)
const exerciseMappings: ExerciseMapping[] = [
  // Legs
  { swedish: 'Knäböj', english: 'Squat', videoKeywords: ['squat', 'back squat'] },
  { swedish: 'Benpress', english: 'Leg Press', videoKeywords: ['leg press'] },
  { swedish: 'Marklyft', english: 'Deadlift', videoKeywords: ['deadlift', 'conventional deadlift'] },
  { swedish: 'Rumänsk marklyft', english: 'Romanian Deadlift', videoKeywords: ['romanian deadlift', 'rdl'] },
  { swedish: 'Benböjningar', english: 'Leg Curl', videoKeywords: ['leg curl', 'hamstring curl'] },
  { swedish: 'Bensträckningar', english: 'Leg Extension', videoKeywords: ['leg extension', 'quad extension'] },
  { swedish: 'Utfallssteg', english: 'Lunge', videoKeywords: ['lunge', 'walking lunge'] },
  { swedish: 'Bultgarian split squat', english: 'Bulgarian Split Squat', videoKeywords: ['bulgarian split squat'] },
  { swedish: 'Vadpress', english: 'Calf Raise', videoKeywords: ['calf raise', 'standing calf'] },
  
  // Chest
  { swedish: 'Bänkpress', english: 'Bench Press', videoKeywords: ['bench press', 'barbell bench'] },
  { swedish: 'Bänkpress med hantlar', english: 'Dumbbell Bench Press', videoKeywords: ['dumbbell bench', 'db bench'] },
  { swedish: 'Incline bänkpress', english: 'Incline Bench Press', videoKeywords: ['incline bench', 'incline press'] },
  { swedish: 'Dips', english: 'Dip', videoKeywords: ['dip', 'chest dip', 'parallel bar dip'] },
  { swedish: 'Cables flyes', english: 'Cable Fly', videoKeywords: ['cable fly', 'cable flyes', 'cable chest fly'] },
  { swedish: 'Armhävningar', english: 'Push Up', videoKeywords: ['push up', 'pushup'] },
  
  // Back
  { swedish: 'Latdrag', english: 'Lat Pulldown', videoKeywords: ['lat pulldown', 'pulldown'] },
  { swedish: 'Chins', english: 'Pull Up', videoKeywords: ['pull up', 'pullup', 'chin up'] },
  { swedish: 'Rodd med skivstång', english: 'Barbell Row', videoKeywords: ['barbell row', 'bent over row'] },
  { swedish: 'Rodd med hantlar', english: 'Dumbbell Row', videoKeywords: ['dumbbell row', 'db row', 'one arm row'] },
  { swedish: 'Cable rodd', english: 'Cable Row', videoKeywords: ['cable row', 'seated cable row'] },
  { swedish: 'T-bar rodd', english: 'T-Bar Row', videoKeywords: ['t-bar row', 't bar row'] },
  { swedish: 'Face pulls', english: 'Face Pull', videoKeywords: ['face pull', 'face pulls'] },
  
  // Shoulders
  { swedish: 'Axelpress', english: 'Overhead Press', videoKeywords: ['overhead press', 'shoulder press', 'military press'] },
  { swedish: 'Axelpress med hantlar', english: 'Dumbbell Shoulder Press', videoKeywords: ['dumbbell shoulder press', 'db press'] },
  { swedish: 'Sidolyft', english: 'Lateral Raise', videoKeywords: ['lateral raise', 'side raise', 'dumbbell lateral'] },
  { swedish: 'Framlyft', english: 'Front Raise', videoKeywords: ['front raise'] },
  { swedish: 'Reverse flyes', english: 'Reverse Fly', videoKeywords: ['reverse fly', 'rear delt fly'] },
  { swedish: 'Arnold press', english: 'Arnold Press', videoKeywords: ['arnold press'] },
  
  // Arms
  { swedish: 'Bicepscurl med skivstång', english: 'Barbell Curl', videoKeywords: ['barbell curl', 'bicep curl'] },
  { swedish: 'Bicepscurl med hantlar', english: 'Dumbbell Curl', videoKeywords: ['dumbbell curl', 'db curl'] },
  { swedish: 'Hammarcurl', english: 'Hammer Curl', videoKeywords: ['hammer curl'] },
  { swedish: 'Triceps pushdown', english: 'Tricep Pushdown', videoKeywords: ['tricep pushdown', 'cable pushdown'] },
  { swedish: 'Skullcrushers', english: 'Skull Crusher', videoKeywords: ['skull crusher', 'lying tricep extension'] },
  { swedish: 'Tricepsdips', english: 'Tricep Dip', videoKeywords: ['tricep dip', 'bench dip'] },
  { swedish: 'Close grip bänkpress', english: 'Close Grip Bench Press', videoKeywords: ['close grip bench'] },
  
  // Core
  { swedish: 'Plankan', english: 'Plank', videoKeywords: ['plank', 'front plank'] },
  { swedish: 'Rygglyft', english: 'Back Extension', videoKeywords: ['back extension', 'hyperextension'] },
  { swedish: 'Crunch', english: 'Crunch', videoKeywords: ['crunch', 'sit up'] },
  { swedish: 'Russian twist', english: 'Russian Twist', videoKeywords: ['russian twist'] },
  { swedish: 'Hanging leg raise', english: 'Hanging Leg Raise', videoKeywords: ['hanging leg raise'] },
];

/**
 * Fuzzy match video title to exercise
 */
function matchVideoToExercise(videoTitle: string, mapping: ExerciseMapping): number {
  const lowerTitle = videoTitle.toLowerCase();
  
  // Check exact english name match
  if (lowerTitle.includes(mapping.english.toLowerCase())) {
    return 100; // Perfect match
  }
  
  // Check keywords
  if (mapping.videoKeywords) {
    for (const keyword of mapping.videoKeywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        return 90; // Very good match
      }
    }
  }
  
  // Check partial match
  const words = mapping.english.toLowerCase().split(' ');
  let matchedWords = 0;
  for (const word of words) {
    if (lowerTitle.includes(word)) {
      matchedWords++;
    }
  }
  
  if (matchedWords > 0) {
    return (matchedWords / words.length) * 80; // Partial match
  }
  
  return 0; // No match
}

async function seedYouTubeExercises() {
  console.log('🎬 Starting YouTube exercise seeding...\n');

  try {
    // Fetch all videos from @DeltaBolic
    const videos = await youtubeService.getDeltaBolicVideos();
    console.log(`\n✅ Fetched ${videos.length} videos from @DeltaBolic\n`);

    let matchedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;

    // Match each mapping to best video
    for (const mapping of exerciseMappings) {
      let bestMatch: { videoId: string; title: string; score: number; isShort: boolean } | null = null;

      // Find best matching video
      for (const video of videos) {
        const score = matchVideoToExercise(video.title, mapping);
        if (score > 50 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = {
            videoId: video.videoId,
            title: video.title,
            score,
            isShort: video.isShort,
          };
        }
      }

      if (bestMatch) {
        matchedCount++;
        const videoUrl = `https://www.youtube.com/watch?v=${bestMatch.videoId}`;
        const videoType = bestMatch.isShort ? 'shorts' : 'video';

        console.log(`✓ ${mapping.swedish} (${mapping.english})`);
        console.log(`  → ${bestMatch.title}`);
        console.log(`  → ${videoUrl} (${videoType}, score: ${bestMatch.score})\n`);

        // Check if exercise exists
        const existing = await db
          .select()
          .from(exercises)
          .where(eq(exercises.name, mapping.swedish))
          .limit(1);

        if (existing.length > 0) {
          // Update existing exercise
          await db
            .update(exercises)
            .set({
              nameEn: mapping.english,
              youtubeUrl: videoUrl,
              videoType: videoType,
            })
            .where(eq(exercises.name, mapping.swedish));
          updatedCount++;
        } else {
          // Create new exercise (minimal data for now)
          await db.insert(exercises).values({
            name: mapping.swedish,
            nameEn: mapping.english,
            youtubeUrl: videoUrl,
            videoType: videoType,
            category: 'strength',
            difficulty: 'intermediate',
            primaryMuscles: ['unknown'],
            secondaryMuscles: [],
            requiredEquipment: ['unknown'],
            isCompound: false,
          });
          createdCount++;
        }
      } else {
        console.log(`✗ ${mapping.swedish} (${mapping.english}) - No match found\n`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`Total exercises: ${exerciseMappings.length}`);
    console.log(`Matched: ${matchedCount}`);
    console.log(`Created: ${createdCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Not matched: ${exerciseMappings.length - matchedCount}`);

  } catch (error) {
    console.error('❌ Error seeding exercises:', error);
    process.exit(1);
  }
}

export { seedYouTubeExercises };

// Run if called directly
seedYouTubeExercises()
  .then(() => {
    console.log('\n✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
