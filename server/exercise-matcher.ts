import { db } from "./db";
import { exercises, unmappedExercises } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Exercise Matching System
 * Strategy B: Fuzzy matching with admin review for unmapped exercises
 * 
 * This service matches AI-generated exercise names to our catalog using:
 * 1. Name normalization (lowercase, remove punctuation)
 * 2. Alias mapping (common variations)
 * 3. Levenshtein distance (edit distance)
 * 4. Logging unmapped exercises for admin review
 */

// Normalize exercise name for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

// Extract core exercise name by removing common modifiers and extra words
function extractCoreName(name: string): string {
  const normalized = normalizeName(name);
  
  // Remove common prefixes/suffixes and extra descriptive words
  const modifiers = [
    'seated', 'standing', 'lying', 'prone', 'supine',
    'dumbbell', 'barbell', 'cable', 'machine', 'smith',
    'wide grip', 'narrow grip', 'close grip', 'reverse grip',
    'incline', 'decline', 'flat',
    'one arm', 'two arm', 'single arm', 'double arm',
    'alternating', 'unilateral', 'bilateral',
    'with', 'using', 'on', 'at',
    // Remove parenthetical information
    /\s*\([^)]*\)/g,
  ];
  
  let core = normalized;
  for (const modifier of modifiers) {
    if (typeof modifier === 'string') {
      const regex = new RegExp(`\\b${modifier}\\b`, 'gi');
      core = core.replace(regex, '');
    } else {
      core = core.replace(modifier, '');
    }
  }
  
  // Clean up extra spaces
  core = core.replace(/\s+/g, ' ').trim();
  
  return core;
}

// Check if two exercise names are similar (word-based matching)
function areSimilarNames(name1: string, name2: string): boolean {
  const core1 = extractCoreName(name1);
  const core2 = extractCoreName(name2);
  
  // If core names match exactly, they're similar
  if (core1 === core2) {
    return true;
  }
  
  // Split into words and check if all words from shorter name exist in longer
  const words1 = core1.split(/\s+/).filter(w => w.length > 2); // Ignore short words
  const words2 = core2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) {
    return false;
  }
  
  // Check if all words from shorter name exist in longer name
  const shorter = words1.length <= words2.length ? words1 : words2;
  const longer = words1.length > words2.length ? words1 : words2;
  
  const allWordsMatch = shorter.every(word => 
    longer.some(longWord => longWord.includes(word) || word.includes(longWord))
  );
  
  return allWordsMatch;
}

// Calculate Levenshtein distance (edit distance) between two strings
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize first column and row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Common exercise name aliases (AI might generate these variations)
// Keys are canonical English names, values are common variations
const exerciseAliases: Record<string, string[]> = {
  "Back Squat": ["squat", "barbell squat", "back squat", "backsquat", "knäböj", "high bar squat", "low bar squat"],
  "Bench Press": ["bench press", "barbell bench press", "flat bench press", "bänkpress", "flat bench", "bb bench press"],
  "Deadlift": ["deadlift", "conventional deadlift", "barbell deadlift", "marklyft", "standard deadlift", "dl"],
  "Overhead Press": ["overhead press", "shoulder press", "military press", "standing press", "axelpress", "ohp", "seated dumbbell overhead press", "dumbbell overhead press", "seated overhead press", "barbell overhead press", "standing overhead press"],
  "Lat Pulldown": ["lat pulldown", "lat pull down", "wide grip pulldown", "latsdrag", "pulldown", "cable lat pulldown", "cable lat pulldown wide grip", "lat pull-down", "machine lat pulldown"],
  "Barbell Row": ["barbell row", "bent over row", "pendlay row", "bb row", "rodd", "cable seated row", "seated row", "cable row", "bent-over row", "barbell bent over row"],
  "Barbell Curl": ["barbell curl", "bicep curl", "ez bar curl", "bicepscurl", "standing barbell curl", "bb curl"],
  "Triceps Pushdown": ["triceps pushdown", "cable pushdown", "tricep pushdown", "rope pushdown", "cable triceps pushdown", "tricep extension", "cable tricep extension"],
  "Leg Press": ["leg press", "benpress", "machine leg press", "45 degree leg press"],
  "Leg Curl": ["leg curl", "lying leg curl", "hamstring curl", "bencurl", "seated leg curl", "machine leg curl"],
  "Leg Extension": ["leg extension", "quad extension", "benförlängning", "bensträck", "machine leg extension"],
  "Calf Raise": ["calf raise", "standing calf raise", "seated calf raise", "vadpress", "calf raises", "machine calf raise"],
  "Push Up": ["push up", "pushup", "push-up", "armhävning", "push ups", "pushups"],
  "Pull Up": ["pull up", "pullup", "pull-up", "chin up", "chins", "pullups", "pull ups", "weighted pull up", "bodyweight pull up"],
  "Dip": ["dip", "dips", "parallel bar dip", "tricep dip", "chest dip", "weighted dip", "bodyweight dip"],
  "Plank": ["plank", "front plank", "plankan", "forearm plank", "elbow plank"],
  "Crunch": ["crunch", "ab crunch", "abdominal crunch", "sit up", "crunches"],
  "Hip Thrust": ["hip thrust", "barbell hip thrust", "glute bridge", "höftlyft", "hip thrusts"],
  "Lateral Raise": ["lateral raise", "side raise", "dumbbell lateral raise", "lat raise", "sidan lyft", "side lateral raise", "lateral raises"],
  "Front Raise": ["front raise", "dumbbell front raise", "framåtlyft", "front raises", "barbell front raise"],
  "Rear Delt Fly": ["rear delt fly", "rear delt raise", "reverse fly", "bakåtlyft", "rear deltoid fly", "reverse flye"],
  "Incline Bench Press": ["incline bench", "incline press", "incline barbell bench", "incline dumbbell press", "incline db press", "incline bench press"],
  "Dumbbell Bench Press": ["dumbbell bench", "dumbbell press", "db bench press", "hantelpress", "flat dumbbell press"],
  "Romanian Deadlift": ["romanian deadlift", "rdl", "stiff leg deadlift", "rumänsk marklyft", "barbell romanian deadlift"],
  "Walking Lunge": ["walking lunge", "lunges", "forward lunge", "utfallssteg", "walking lunges", "dumbbell walking lunge"],
  "Bulgarian Split Squat": ["bulgarian split squat", "split squat", "rear foot elevated split squat", "bulgariska splitknäböj", "bulgarian split squats"],
  "Hammer Curl": ["hammer curl", "neutral grip curl", "hammer curls", "dumbbell hammer curl"],
  "Preacher Curl": ["preacher curl", "scott curl", "preacher curls", "ez bar preacher curl"],
  "Face Pull": ["face pull", "face pulls", "rear delt pull", "cable face pull", "facepulls", "rope face pull"],
  "Farmer Walk": ["farmers walk", "farmer walk", "farmer carry", "farmers carry", "farmer's walk", "dumbbell farmer walk"],
  "Kettlebell Swing": ["kettlebell swing", "kb swing", "russian swing", "kettlebell swings", "two hand swing"],
  // Additional common variations
  "Goblet Squat": ["goblet squat", "goblet squats", "dumbbell goblet squat", "kettlebell goblet squat"],
  "Cable Fly": ["cable fly", "cable flye", "cable chest fly", "standing cable fly", "cable flys"],
  "Tricep Dip": ["tricep dip", "triceps dip", "bench dip", "tricep dips"],
  "Bicep Curl": ["bicep curl", "dumbbell curl", "db curl", "biceps curl", "bicep curls"],
  "Skull Crusher": ["skull crusher", "lying tricep extension", "skullcrusher", "skull crushers", "ez bar skull crusher"],
  "Arnold Press": ["arnold press", "arnold shoulder press", "dumbbell arnold press", "arnold presses"],
  "Upright Row": ["upright row", "barbell upright row", "upright rows", "dumbbell upright row"],
  "Shrug": ["shrug", "barbell shrug", "dumbbell shrug", "shrugs", "trap shrug"],
  "Good Morning": ["good morning", "barbell good morning", "good mornings"],
  "Glute Bridge": ["glute bridge", "hip bridge", "bodyweight glute bridge", "glute bridges"],
  "Box Jump": ["box jump", "box jumps", "plyo box jump", "plyometric box jump"],
  "Burpee": ["burpee", "burpees"],
  "Mountain Climber": ["mountain climber", "mountain climbers"],
  "Jumping Jack": ["jumping jack", "jumping jacks", "star jump"],
  "High Knee": ["high knee", "high knees", "running in place"],
  "Butt Kick": ["butt kick", "butt kicks", "heel kick"],
  // Machine variations
  "Chest Press Machine": ["chest press", "machine chest press", "seated chest press"],
  "Shoulder Press Machine": ["shoulder press machine", "machine shoulder press", "seated shoulder press machine"],
  "Leg Press Machine": ["leg press machine", "machine leg press"],
  // Cable variations
  "Cable Crossover": ["cable crossover", "cable cross", "cable chest fly", "cable crossovers"],
  "Cable Row": ["cable row", "seated cable row", "low cable row", "cable rows"],
  "Cable Curl": ["cable curl", "cable bicep curl", "cable curls"],
};

// Build reverse alias map for faster lookup
const aliasToCanonical: Map<string, string> = new Map();
for (const [canonical, aliases] of Object.entries(exerciseAliases)) {
  for (const alias of aliases) {
    aliasToCanonical.set(normalizeName(alias), canonical);
  }
}

interface MatchResult {
  matched: boolean;
  exerciseName: string | null;
  id?: string;
  confidence: 'exact' | 'alias' | 'fuzzy' | 'none';
  distance?: number;
}

/**
 * Match an AI-generated exercise name to our catalog
 * Returns the canonical English name if found, or null if no match
 */
export async function matchExercise(aiGeneratedName: string): Promise<MatchResult> {
  const normalized = normalizeName(aiGeneratedName);
  console.log(`[EXERCISE MATCHER] 🔍 Matching: "${aiGeneratedName}" (normalized: "${normalized}")`);
  
  // Step 1: Try exact match on normalized nameEn (ENGLISH ONLY - nameEn must exist)
  // Explicitly select only the columns we need to avoid exercise_id reference issues
  const exactMatch = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      nameEn: exercises.nameEn,
    })
    .from(exercises)
    .where(
      sql`${exercises.nameEn} IS NOT NULL 
       AND (LOWER(REGEXP_REPLACE(${exercises.nameEn}, '[^\\w\\s]', '', 'g')) = ${normalized}
         OR LOWER(REGEXP_REPLACE(${exercises.name}, '[^\\w\\s]', '', 'g')) = ${normalized})`
    )
    .limit(1);

  if (exactMatch.length > 0) {
    console.log(`[EXERCISE MATCHER] ✅ Exact match found: "${exactMatch[0].nameEn}"`);
    return {
      matched: true,
      id: exactMatch[0].id,
      exerciseName: exactMatch[0].nameEn!, // Always exists due to WHERE clause
      confidence: 'exact',
    };
  }

  // Step 2: Try alias matching (ENGLISH ONLY - nameEn must exist)
  // First try exact alias match
  const canonicalFromAlias = aliasToCanonical.get(normalized);
  if (canonicalFromAlias) {
    const aliasMatch = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        nameEn: exercises.nameEn,
      })
      .from(exercises)
      .where(
        sql`${exercises.nameEn} IS NOT NULL AND ${exercises.nameEn} = ${canonicalFromAlias}`
      )
      .limit(1);

    if (aliasMatch.length > 0) {
      console.log(`[EXERCISE MATCHER] ✅ Alias match found: "${aiGeneratedName}" → "${aliasMatch[0].nameEn}" (via "${canonicalFromAlias}")`);
      return {
        matched: true,
        id: aliasMatch[0].id,
        exerciseName: aliasMatch[0].nameEn!, // Always exists due to WHERE clause
        confidence: 'alias',
      };
    }
  }
  
  // Step 2b: Try partial alias matching (check if normalized name contains any alias)
  console.log(`[EXERCISE MATCHER] 🔄 Trying partial alias matching...`);
  const coreName = extractCoreName(aiGeneratedName);
  for (const [alias, canonical] of Array.from(aliasToCanonical.entries())) {
    const normalizedAlias = normalizeName(alias);
    // Check if core name contains alias or vice versa
    if (coreName.includes(normalizedAlias) || normalizedAlias.includes(coreName)) {
      const aliasMatch = await db
        .select({
          id: exercises.id,
          name: exercises.name,
          nameEn: exercises.nameEn,
        })
        .from(exercises)
        .where(
          sql`${exercises.nameEn} IS NOT NULL AND ${exercises.nameEn} = ${canonical}`
        )
        .limit(1);

      if (aliasMatch.length > 0) {
        console.log(`[EXERCISE MATCHER] ✅ Partial alias match found: "${aiGeneratedName}" → "${aliasMatch[0].nameEn}" (via "${canonical}")`);
        return {
          matched: true,
          id: aliasMatch[0].id,
          exerciseName: aliasMatch[0].nameEn!,
          confidence: 'alias',
        };
      }
    }
  }

  // Step 3: Try word-based similarity matching (more flexible than exact fuzzy)
  console.log(`[EXERCISE MATCHER] 🔄 Trying word-based similarity matching...`);
  const allExercises = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      nameEn: exercises.nameEn,
    })
    .from(exercises)
    .where(sql`${exercises.nameEn} IS NOT NULL`); // Only exercises with English names
  
  // First try word-based similarity (handles variations like "Seated Dumbbell Overhead Press" -> "Overhead Press")
  for (const exercise of allExercises) {
    if (areSimilarNames(aiGeneratedName, exercise.nameEn!)) {
      console.log(`[EXERCISE MATCHER] ✅ Word-based similarity match found: "${aiGeneratedName}" → "${exercise.nameEn}"`);
      return {
        matched: true,
        id: exercise.id,
        exerciseName: exercise.nameEn!,
        confidence: 'fuzzy',
      };
    }
  }

  // Step 4: Try fuzzy matching (Levenshtein distance) - ENGLISH ONLY
  // Use percentage-based threshold: ~8% of name length with minimum of 2
  // This tightens matching for short names while remaining flexible for longer ones
  let bestMatch: typeof allExercises[0] | null = null;
  let bestDistance = Infinity;

  for (const exercise of allExercises) {
    // Match against English name (nameEn guaranteed to exist)
    const exerciseNormalized = normalizeName(exercise.nameEn!);
    const distanceEnglish = levenshteinDistance(normalized, exerciseNormalized);
    
    // Calculate dynamic threshold based on the longer of the two names
    const maxLength = Math.max(normalized.length, exerciseNormalized.length);
    const dynamicThreshold = Math.max(2, Math.floor(maxLength * 0.08)); // 8% with minimum 2
    
    // Also try matching against core name (without modifiers)
    const coreAI = extractCoreName(aiGeneratedName);
    const coreExercise = extractCoreName(exercise.nameEn!);
    const coreDistance = levenshteinDistance(coreAI, coreExercise);
    
    const minDistance = Math.min(distanceEnglish, coreDistance);
    
    if (minDistance < bestDistance && minDistance <= dynamicThreshold) {
      bestDistance = minDistance;
      bestMatch = exercise;
    }
  }

  if (bestMatch) {
    console.log(`[EXERCISE MATCHER] ✅ Fuzzy match found: "${aiGeneratedName}" → "${bestMatch.nameEn}" (distance: ${bestDistance})`);
    return {
      matched: true,
      id: bestMatch.id,
      exerciseName: bestMatch.nameEn!, // Always exists due to WHERE clause
      confidence: 'fuzzy',
      distance: bestDistance,
    };
  }

  // Step 5: No match found - Log for admin review BEFORE attempting auto-expand
  // This ensures all AI-generated exercise names are captured for manual alias mapping
  console.log(`[EXERCISE MATCHER] ⚠️ No match found for "${aiGeneratedName}" - logging for admin review...`);
  await logUnmappedExercise(aiGeneratedName, null);
  
  // Now try auto-expand catalog
  console.log(`[EXERCISE MATCHER] 🔧 Attempting auto-expand for "${aiGeneratedName}"...`);
  const newExercise = await createExerciseFromAI(aiGeneratedName);
  
  if (newExercise) {
    return {
      matched: true,
      id: newExercise.id,
      exerciseName: newExercise.name,
      confidence: 'none', // Auto-created, no prior match
    };
  }

  // Auto-creation failed - exercise already logged above
  console.log(`[EXERCISE MATCHER] ❌ Could not auto-create exercise "${aiGeneratedName}"`);

  return {
    matched: false,
    exerciseName: null,
    confidence: 'none',
  };
}

/**
 * Auto-expand catalog: Create new exercise from AI-generated name
 * Tries to determine if name is Swedish or English and populates accordingly
 */
/**
 * Auto-expand catalog: Create new exercise from AI-generated name
 * Tries to determine if name is Swedish or English and populates accordingly
 */
async function createExerciseFromAI(aiGeneratedName: string): Promise<{ id: string; name: string } | null> {
  try {
    // Check if exercise already exists (avoid duplicates)
    // Explicitly select only the columns we need to avoid exercise_id reference issues
    const existing = await db
      .select({
        id: exercises.id,
        name: exercises.name,
        nameEn: exercises.nameEn,
      })
      .from(exercises)
      .where(
        sql`${exercises.nameEn} = ${aiGeneratedName} OR ${exercises.name} = ${aiGeneratedName}`
      )
      .limit(1);

    if (existing.length > 0) {
      return { id: existing[0].id, name: existing[0].nameEn || existing[0].name };
    }

    // Determine if name is likely Swedish or English based on character set
    const hasSwedishChars = /[åäöÅÄÖ]/.test(aiGeneratedName);
    const isSwedish = hasSwedishChars || aiGeneratedName.toLowerCase().includes('böj') || 
                      aiGeneratedName.toLowerCase().includes('lyft');

    // CRITICAL: Reject Swedish names - we only accept English exercises
    if (isSwedish) {
      console.warn(`[AUTO-EXPAND] Rejected Swedish exercise name: ${aiGeneratedName}`);
      await logUnmappedExercise(aiGeneratedName, 'Rejected: Swedish name (English-only policy)');
      return null;
    }

    // Create new exercise with English name
    // Always populate nameEn for auto-created exercises (English-only policy)
    // NOTE: Do NOT include exerciseId - it's optional and causes database errors if included
    const [newExercise] = await db.insert(exercises).values({
      name: aiGeneratedName, // Fallback for display
      nameEn: aiGeneratedName, // CRITICAL: Always populate nameEn
      category: 'strength', // Default category
      difficulty: 'intermediate',
      primaryMuscles: ['unknown'], // Placeholder
      secondaryMuscles: [],
      requiredEquipment: ['unknown'], // Placeholder
      isCompound: false,
      youtubeUrl: null, // No video yet - admin can add later
      videoType: null,
      // exerciseId is explicitly omitted - it's optional and causes errors
    }).returning();

    console.log(`[AUTO-EXPAND] Created new exercise: ${newExercise.nameEn || newExercise.name} (AI-generated)`);

    return { id: newExercise.id, name: newExercise.nameEn || newExercise.name };
  } catch (error) {
    console.error(`[AUTO-EXPAND] Failed to create exercise "${aiGeneratedName}":`, error);
    return null;
  }
}

/**
 * Log an unmapped exercise for admin review
 * Increments count if already exists, creates new entry otherwise
 */
export async function logUnmappedExercise(aiName: string, suggestedMatch: string | null = null) {
  try {
    // Try to find existing unmapped exercise
    const existing = await db
      .select()
      .from(unmappedExercises)
      .where(eq(unmappedExercises.aiName, aiName))
      .limit(1);

    if (existing.length > 0) {
      // Increment count and update lastSeen
      await db
        .update(unmappedExercises)
        .set({
          count: sql`${unmappedExercises.count} + 1`,
          lastSeen: new Date(),
        })
        .where(eq(unmappedExercises.aiName, aiName));
    } else {
      // Create new entry
      await db.insert(unmappedExercises).values({
        aiName,
        suggestedMatch,
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
      });
    }
  } catch (error) {
    console.error(`Failed to log unmapped exercise "${aiName}":`, error);
  }
}

/**
 * Get all unmapped exercises sorted by count (most frequent first)
 * Used by admin endpoint
 */
export async function getUnmappedExercises() {
  return await db
    .select()
    .from(unmappedExercises)
    .orderBy(sql`${unmappedExercises.count} DESC`);
}

/**
 * Helper to serialize exercise with guaranteed nameEn fallback
 * Ensures nameEn is never undefined in AI prompts
 */
function serializeExercise(ex: any): { id: number; nameEn: string; name: string; youtubeUrl: string | null } {
  return {
    id: ex.id,
    nameEn: ex.nameEn || ex.name || 'Unknown Exercise',
    name: ex.name || 'Unknown Exercise',
    youtubeUrl: ex.youtubeUrl,
  };
}

/**
 * Filter exercises based on user's available equipment at a specific gym
 * Returns only exercises that can be performed with the user's equipment
 * @param userId - User ID
 * @param gymId - Gym ID (optional, uses selected gym if not provided)
 * @returns Array of exercises with English names that match available equipment
 */
export async function filterExercisesByUserEquipment(
  userId: string, 
  gymId?: string
): Promise<Array<{ id: number; nameEn: string; name: string; youtubeUrl: string | null }>> {
  try {
    // Get user's selected gym if gymId not provided
    let targetGymId = gymId;
    if (!targetGymId) {
      const { userProfiles } = await import("@shared/schema");
      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);
      
      targetGymId = profile?.selectedGymId || undefined;
    }

    // Get user's equipment (gym-specific or all if no gym selected)
    const { userEquipment } = await import("@shared/schema");
    let userEq;
    
    if (targetGymId) {
      // Get equipment for specific gym
      userEq = await db
        .select()
        .from(userEquipment)
        .where(
          sql`${userEquipment.userId} = ${userId} AND ${userEquipment.gymId} = ${targetGymId}`
        );
      console.log(`[EXERCISE FILTER] Filtering for gym ${targetGymId}`);
    } else {
      // Fallback: Get all equipment for user across all gyms
      userEq = await db
        .select()
        .from(userEquipment)
        .where(sql`${userEquipment.userId} = ${userId}`);
      console.log(`[EXERCISE FILTER] No gym selected - using aggregate equipment`);
    }

    if (userEq.length === 0) {
      console.warn(`[EXERCISE FILTER] No equipment found for user ${userId}`);
      console.warn(`[EXERCISE FILTER] Fallback: returning all bodyweight exercises with English names`);
      
      // Fallback: Return only bodyweight exercises with English names
      const allExercises = await db.select().from(exercises);
      const bodyweightExercises = allExercises.filter(ex => 
        ex.nameEn && (!ex.requiredEquipment || ex.requiredEquipment.length === 0)
      );
      
      return bodyweightExercises.map(serializeExercise);
    }

    // Extract equipment names (normalize for matching)
    const availableEquipment = userEq.map(eq => 
      normalizeName(eq.equipmentName)
    );

    console.log(`[EXERCISE FILTER] User has ${availableEquipment.length} pieces of equipment at gym ${targetGymId}`);
    console.log(`[EXERCISE FILTER] Available equipment:`, availableEquipment);

    // Get all exercises from catalog
    const allExercises = await db.select().from(exercises);

    // Filter exercises where ALL required equipment is available
    // AND exercise has English name (nameEn is not null)
    const matchingExercises = allExercises.filter(exercise => {
      // CRITICAL: Only include exercises with English names
      if (!exercise.nameEn) {
        return false;
      }
      
      // If requiredEquipment is null/empty, it means bodyweight exercise - always available
      if (!exercise.requiredEquipment || exercise.requiredEquipment.length === 0) {
        return true;
      }

      // Normalize required equipment
      const required = exercise.requiredEquipment.map(eq => normalizeName(eq));
      
      // Allow 'unknown' equipment (from auto-created exercises) - treat as available
      // Admin can review and update later via unmapped_exercises table
      const filteredRequired = required.filter(req => req !== 'unknown');
      
      // If only 'unknown' equipment, treat as available
      if (filteredRequired.length === 0) {
        return true;
      }

      // Check if ALL required equipment (excluding 'unknown') is available
      // Use strict matching to prevent false positives
      // Example: If exercise requires "cable" and user only has "machine", it should NOT match
      // But if exercise requires "barbell" and user has "Olympic Barbell", it SHOULD match
      const allAvailable = filteredRequired.every(req => {
        const normalizedReq = normalizeName(req);
        
        // Try exact match first (case-insensitive)
        if (availableEquipment.some(avail => avail === normalizedReq)) {
          return true;
        }
        
        // For multi-word requirements (e.g., "cable machine"), require that ALL words match
        // This prevents "cable" from matching when only "machine" is available
        const reqWords = normalizedReq.split(/\s+/).filter(w => w.length > 0);
        
        if (reqWords.length > 1) {
          // Multi-word requirement: ALL words must be present in at least one available equipment
          return availableEquipment.some(avail => {
            const availWords = avail.split(/\s+/);
            // Check if all requirement words exist in available equipment
            return reqWords.every(reqWord => 
              availWords.some(availWord => availWord === reqWord || availWord.includes(reqWord))
            );
          });
        } else {
          // Single word requirement: check if it appears as a complete word in any available equipment
          // This allows "barbell" to match "Olympic Barbell" but prevents "cable" from matching "machine"
          return availableEquipment.some(avail => {
            const availWords = avail.split(/\s+/);
            // Check if requirement word is a complete word in available equipment
            return availWords.some(availWord => 
              availWord === normalizedReq || availWord.includes(normalizedReq)
            );
          });
        }
      });

      return allAvailable;
    });

    console.log(`[EXERCISE FILTER] ${matchingExercises.length} exercises match user's equipment`);

    // Ultimate fallback: If no exercises match, return bodyweight exercises with English names
    if (matchingExercises.length === 0) {
      console.warn(`[EXERCISE FILTER] No exercises matched equipment - falling back to bodyweight exercises`);
      const allExercises = await db.select().from(exercises);
      const bodyweightExercises = allExercises.filter(ex => 
        ex.nameEn && (!ex.requiredEquipment || ex.requiredEquipment.length === 0)
      );
      console.log(`[EXERCISE FILTER] Returning ${bodyweightExercises.length} bodyweight exercises as fallback`);
      
      return bodyweightExercises.map(serializeExercise);
    }

    // Return exercises with English names (using centralized serialization)
    return matchingExercises.map(serializeExercise);
  } catch (error) {
    console.error(`[EXERCISE FILTER] Failed to filter exercises:`, error);
    // Emergency fallback: Return empty array (AI will use equipment list only)
    return [];
  }
}
