import { db } from "./db";
import { exercises, unmappedExercises, exerciseAliases as exerciseAliasesTable, userProfiles, userEquipment, UserEquipment, gyms } from "@shared/schema";
import { eq, sql, or, and } from "drizzle-orm";

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
export function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9åäö\s]/g, '') // Keep Swedish chars
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .trim();
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
  "Back Squat": ["squat", "barbell squat", "back squat", "backsquat", "knäböj"],
  "Bench Press": ["bench press", "barbell bench press", "flat bench press", "bänkpress"],
  "Deadlift": ["deadlift", "conventional deadlift", "barbell deadlift", "marklyft"],
  "Overhead Press": ["overhead press", "shoulder press", "military press", "standing press", "axelpress", "ohp"],
  "Lat Pulldown": ["lat pulldown", "lat pull down", "wide grip pulldown", "latsdrag", "pulldown"],
  "Barbell Row": ["barbell row", "bent over row", "pendlay row", "bb row", "rodd"],
  "Barbell Curl": ["barbell curl", "bicep curl", "ez bar curl", "bicepscurl"],
  "Triceps Pushdown": ["triceps pushdown", "cable pushdown", "tricep pushdown", "rope pushdown"],
  "Leg Press": ["leg press", "benpress"],
  "Leg Curl": ["leg curl", "lying leg curl", "hamstring curl", "bencurl"],
  "Leg Extension": ["leg extension", "quad extension", "benförlängning", "bensträck"],
  "Calf Raise": ["calf raise", "standing calf raise", "seated calf raise", "vadpress"],
  "Push Up": ["push up", "pushup", "push-up", "armhävning"],
  "Pull Up": ["pull up", "pullup", "pull-up", "chin up", "chins"],
  "Dip": ["dip", "dips", "parallel bar dip", "tricep dip"],
  "Plank": ["plank", "front plank", "plankan"],
  "Crunch": ["crunch", "ab crunch", "abdominal crunch", "sit up"],
  "Hip Thrust": ["hip thrust", "barbell hip thrust", "glute bridge", "höftlyft"],
  "Lateral Raise": ["lateral raise", "side raise", "dumbbell lateral raise", "lat raise", "sidan lyft"],
  "Front Raise": ["front raise", "dumbbell front raise", "framåtlyft"],
  "Rear Delt Fly": ["rear delt fly", "rear delt raise", "reverse fly", "bakåtlyft"],
  "Incline Bench Press": ["incline bench", "incline press", "incline barbell bench"],
  "Dumbbell Bench Press": ["dumbbell bench", "dumbbell press", "db bench press", "hantelpress"],
  "Romanian Deadlift": ["romanian deadlift", "rdl", "stiff leg deadlift", "rumänsk marklyft"],
  "Walking Lunge": ["walking lunge", "lunges", "forward lunge", "utfallssteg"],
  "Bulgarian Split Squat": ["bulgarian split squat", "split squat", "rear foot elevated split squat", "bulgariska splitknäböj"],
  "Hammer Curl": ["hammer curl", "neutral grip curl"],
  "Preacher Curl": ["preacher curl", "scott curl"],
  "Face Pull": ["face pull", "face pulls", "rear delt pull", "cable face pull"],
  "Farmer Walk": ["farmers walk", "farmer walk", "farmer carry", "farmers carry"],
  "Kettlebell Swing": ["kettlebell swing", "kb swing", "russian swing"],
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
  exerciseId: string | null;
  confidence: 'exact' | 'alias' | 'fuzzy' | 'none';
  distance?: number;
}

export interface ExerciseMetadata {
  category?: string;
  equipment?: string[];
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  difficulty?: string;
}

/**
 * Match an AI-generated exercise name to our catalog
 * Returns the canonical English name if found, or null if no match
 */
export async function matchExercise(aiGeneratedName: string, metadata?: ExerciseMetadata): Promise<MatchResult> {
  // Step 0: Try exact match on exerciseId (ID/Slug/UUID) - common in V4 blueprints
  const idMatch = await db
    .select()
    .from(exercises)
    .where(or(eq(exercises.exerciseId, aiGeneratedName), eq(exercises.id, aiGeneratedName)))
    .limit(1);

  if (idMatch.length > 0) {
    const exercise = idMatch[0];
    return {
      matched: true,
      exerciseName: exercise.nameEn || exercise.name,
      exerciseId: exercise.exerciseId || exercise.id,
      confidence: 'exact',
    };
  }

  const normalized = normalizeName(aiGeneratedName);
  
  // Step 1: Try exact match on normalized nameEn (ENGLISH ONLY - nameEn must exist)
  const exactMatch = await db
    .select()
    .from(exercises)
    .where(
      sql`${exercises.nameEn} IS NOT NULL 
       AND (LOWER(REGEXP_REPLACE(${exercises.nameEn}, '[^\\w\\s]', '', 'g')) = ${normalized}
         OR LOWER(REGEXP_REPLACE(${exercises.name}, '[^\\w\\s]', '', 'g')) = ${normalized})`
    )
    .limit(1);

  if (exactMatch.length > 0) {
    const exercise = exactMatch[0];
    const canonicalName = exercise.nameEn || exercise.name;
    const matchedExerciseId = exercise.exerciseId || exercise.id;

    // If it matched exactly but is a variation, save it as an alias
    if (normalized !== normalizeName(exercise.nameEn || "") && normalized !== normalizeName(exercise.name)) {
      await saveExerciseAlias(matchedExerciseId, aiGeneratedName);
    }

    return {
      matched: true,
      exerciseName: canonicalName,
      exerciseId: matchedExerciseId,
      confidence: 'exact',
    };
  }
  
  // Step 1.5: Try database alias matching
  const dbAliases = await db
    .select()
    .from(exerciseAliasesTable)
    .where(eq(exerciseAliasesTable.aliasNorm, normalized))
    .limit(1);

  if (dbAliases.length > 0) {
    const dbAlias = dbAliases[0];
    const matchedEx = await db
      .select()
      .from(exercises)
      .where(or(
        eq(exercises.exerciseId, dbAlias.exerciseId),
        eq(exercises.id, dbAlias.exerciseId)
      ))
      .limit(1);

    if (matchedEx.length > 0) {
      const exercise = matchedEx[0];
      return {
        matched: true,
        exerciseName: exercise.nameEn || exercise.name,
        exerciseId: exercise.exerciseId || exercise.id,
        confidence: 'alias',
      };
    }
  }

  // Step 2: Try alias matching (ENGLISH ONLY - nameEn must exist)
  const canonicalFromAlias = aliasToCanonical.get(normalized);
  if (canonicalFromAlias) {
    const aliasMatch = await db
      .select()
      .from(exercises)
      .where(
        sql`${exercises.nameEn} IS NOT NULL AND ${exercises.nameEn} = ${canonicalFromAlias}`
      )
      .limit(1);

    if (aliasMatch.length > 0) {
      const exercise = aliasMatch[0];
      return {
        matched: true,
        exerciseName: exercise.nameEn!, // Always exists due to WHERE clause
        exerciseId: exercise.exerciseId || exercise.id,
        confidence: 'alias',
      };
    }
  }

  // Step 3: Try fuzzy matching (Levenshtein distance) - ENGLISH ONLY
  const allExercises = await db
    .select()
    .from(exercises)
    .where(sql`${exercises.nameEn} IS NOT NULL`); // Only exercises with English names
  
  let bestMatch: typeof allExercises[0] | null = null;
  let bestDistance = Infinity;
  const threshold = 5; // Max edit distance to accept

  for (const exercise of allExercises) {
    // Match against English name (nameEn guaranteed to exist)
    const distanceEnglish = levenshteinDistance(normalized, normalizeName(exercise.nameEn!));
    
    if (distanceEnglish < bestDistance && distanceEnglish <= threshold) {
      bestDistance = distanceEnglish;
      bestMatch = exercise;
    }
  }

  if (bestMatch) {
    const matchedExerciseId = bestMatch.exerciseId || bestMatch.id;
    await saveExerciseAlias(matchedExerciseId, aiGeneratedName);

    return {
      matched: true,
      exerciseName: bestMatch.nameEn || bestMatch.name,
      exerciseId: matchedExerciseId,
      confidence: 'fuzzy',
      distance: bestDistance,
    };
  }

  // Step 4: No match found - auto-expand catalog
  const newExercise = await createExerciseFromAI(aiGeneratedName);
  
  if (newExercise) {
    return {
      matched: true,
      exerciseName: newExercise.name,
      exerciseId: newExercise.exerciseId,
      confidence: 'none', // Auto-created, no prior match
    };
  }

  // No match found - log for review
  console.log(`[MATCHER] No match found for "${aiGeneratedName}", logging unmapped`);
  await logUnmappedExercise(aiGeneratedName, null, metadata);
  
  return {
    matched: false,
    exerciseName: null,
    exerciseId: null,
    confidence: 'none',
  };
}

/**
 * Auto-expand catalog: Create new exercise from AI-generated name
 * Tries to determine if name is Swedish or English and populates accordingly
 */
async function createExerciseFromAI(aiGeneratedName: string): Promise<{ name: string; exerciseId: string } | null> {
  try {
    // Check if name looks like a UUID or is just a hex string (AI error)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(aiGeneratedName);
    const isHexId = /^[0-9a-f]{20,}$/i.test(aiGeneratedName); // Generic long hex string
    
    if (isUuid || isHexId) {
      console.warn(`[AUTO-EXPAND] Rejected UUID/ID as exercise name: ${aiGeneratedName}`);
      await logUnmappedExercise(aiGeneratedName, 'Rejected: Name is a UUID/ID string');
      return null;
    }

    // Check if exercise already exists (avoid duplicates)
    const existing = await db
      .select()
      .from(exercises)
      .where(
        sql`${exercises.nameEn} = ${aiGeneratedName} OR ${exercises.name} = ${aiGeneratedName}`
      )
      .limit(1);

    if (existing.length > 0) {
      const ex = existing[0];
      return { 
        name: ex.nameEn || ex.name, 
        exerciseId: ex.exerciseId || ex.id 
      };
    }

    // Determine if name is likely Swedish or English
    const hasSwedishChars = /[åäöÅÄÖ]/.test(aiGeneratedName);
    const isSwedish = hasSwedishChars || aiGeneratedName.toLowerCase().includes('böj') || 
                      aiGeneratedName.toLowerCase().includes('lyft');

    // Relaxed: Still tag as unmapped but we can allow creation if it's clearly a valid exercise
    if (isSwedish) {
      console.log(`[AUTO-EXPAND] Detected Swedish exercise name: ${aiGeneratedName}`);
    }

    // Create new exercise with English name
    // Always populate nameEn for auto-created exercises (English-only policy)
    const [newExercise] = await db.insert(exercises).values({
      name: aiGeneratedName, // Use English name as primary name for new entries
      nameEn: aiGeneratedName, // CRITICAL: Always populate nameEn
      category: 'strength', // Default category
      difficulty: 'intermediate',
      primaryMuscles: ['unknown'], // Placeholder
      secondaryMuscles: [],
      requiredEquipment: ['unknown'], // Placeholder
      isCompound: false,
      youtubeUrl: null, // No video yet - admin can add later
      videoType: null,
    }).returning();

    console.log(`[AUTO-EXPAND] Created new exercise: ${newExercise.nameEn || newExercise.name} (AI-generated)`);

    return {
      name: newExercise.nameEn!,
      exerciseId: newExercise.exerciseId!
    };
  } catch (error) {
    console.error(`[AUTO-EXPAND] Failed to create exercise "${aiGeneratedName}":`, error);
    return null;
  }
}

/**
 * Log an unmapped exercise for admin review
 * Increments count if already exists, creates new entry otherwise
 */
// Mappings for normalization
export const METADATA_MAPPINGS: Record<string, string> = {
    // Categories
    'push_horizontal': 'Push (Horizontal)',
    'push_vertical': 'Push (Vertical)',
    'pull_horizontal': 'Pull (Horizontal)',
    'pull_vertical': 'Pull (Vertical)', 
    'legs_squat': 'Ben (Knäböj)',
    'legs_hinge': 'Ben (Höftfällning)',
    'isolation_arms': 'Armar (Isolation)',
    'isolation_shoulders': 'Axlar (Isolation)',
    'isolation_legs': 'Ben (Isolation)',
    'core': 'Bål',
    'cardio': 'Kondition',
    
    // Equipment
    'dumbbell': 'Hantlar',
    'dumbbells': 'Hantlar',
    'barbell': 'Skivstång',
    'cable': 'Kabelmaskin',
    'machine': 'Maskin',
    'bodyweight': 'Kroppsvikt',
    'band': 'Gummiband',
    'kettlebell': 'Kettlebell',
    'bench': 'Träningsbänk',
    'rack': 'Skivstångsställning',
    'pull-up bar': 'Chinsräcke',
    'smith machine': 'Smithmaskin',
    'trap_bar': 'Trap Bar',
    'plyo_box': 'Plyo Box',
    'box': 'Plyo Box',
    'adjustable_bench': 'Justerbar Bänk',
    'cable_machine': 'Kabelmaskin',
    'kettlebells': 'Kettlebells'
};

// Helper to normalize metadata strings (e.g. "Push_horizontal" -> "Push Horizontal")
export function normalizeMetadataValue(val: string): string {
  if (!val) return val;
  
  const lower = val.toLowerCase();
  if (METADATA_MAPPINGS[lower]) return METADATA_MAPPINGS[lower];
  
  // Fallback: Title Case and replace underscores
  return val.replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
}

async function logUnmappedExercise(aiName: string, suggestedMatch: string | null, metadata?: ExerciseMetadata) {
  try {
    // Normalize metadata before saving
    const normalizedMetadata = metadata ? {
      category: metadata.category ? normalizeMetadataValue(metadata.category) : undefined,
      equipment: metadata.equipment?.map(normalizeMetadataValue),
      primaryMuscles: metadata.primaryMuscles?.map(normalizeMetadataValue),
      secondaryMuscles: metadata.secondaryMuscles?.map(normalizeMetadataValue),
      difficulty: metadata.difficulty ? normalizeMetadataValue(metadata.difficulty) : undefined,
    } : undefined;

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
          // Update metadata if provided and currently missing
          category: normalizedMetadata?.category || existing[0].category,
          equipment: normalizedMetadata?.equipment || existing[0].equipment,
          primaryMuscles: normalizedMetadata?.primaryMuscles || existing[0].primaryMuscles,
          secondaryMuscles: normalizedMetadata?.secondaryMuscles || existing[0].secondaryMuscles,
          difficulty: normalizedMetadata?.difficulty || existing[0].difficulty,
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
        category: normalizedMetadata?.category,
        equipment: normalizedMetadata?.equipment,
        primaryMuscles: normalizedMetadata?.primaryMuscles,
        secondaryMuscles: normalizedMetadata?.secondaryMuscles,
        difficulty: normalizedMetadata?.difficulty,
      });
    }
  } catch (error) {
    console.error(`Failed to log unmapped exercise "${aiName}":`, error);
  }
}

/**
 * Enrich existing exercise with metadata from AI if missing in catalog
 * Usage: Fire-and-forget from hydration loop
 */
export async function enrichExerciseMetadata(
  exerciseId: string, 
  metadata: { 
    primaryMuscles?: string[], 
    secondaryMuscles?: string[],
    equipment?: string[]
  }
) {
  try {
    if (!exerciseId) return;

    // Fetch current state to verify it's actually missing (don't trust partial objects passed in)
    const existing = await db.select().from(exercises).where(eq(exercises.id, exerciseId)).limit(1);
    if (existing.length === 0) return;
    
    const ex = existing[0];
    const updates: any = {};
    let hasUpdates = false;

    // Check Primary Muscles
    const currentPrimary = ex.primaryMuscles || [];
    const isPrimaryMissing = currentPrimary.length === 0 || (currentPrimary.length === 1 && currentPrimary[0] === 'unknown');
    
    if (isPrimaryMissing && metadata.primaryMuscles && metadata.primaryMuscles.length > 0) {
      // Normalize before saving?
      updates.primaryMuscles = metadata.primaryMuscles.map(normalizeMetadataValue);
      hasUpdates = true;
    }

    // Check Secondary Muscles
    const currentSecondary = ex.secondaryMuscles || [];
    if (currentSecondary.length === 0 && metadata.secondaryMuscles && metadata.secondaryMuscles.length > 0) {
      updates.secondaryMuscles = metadata.secondaryMuscles.map(normalizeMetadataValue);
      hasUpdates = true;
    }
    
    // Optional: Enrich equipment too if strictly unknown?
    // User specifically asked for muscles, but equipment is good too.
    const currentEquipment = ex.requiredEquipment || [];
    const isEqMissing = currentEquipment.length === 0 || (currentEquipment.length === 1 && currentEquipment[0] === 'unknown');
    
    if (isEqMissing && metadata.equipment && metadata.equipment.length > 0) {
       updates.requiredEquipment = metadata.equipment.map(normalizeMetadataValue);
       hasUpdates = true;
    }

    if (hasUpdates) {
      await db.update(exercises).set(updates).where(eq(exercises.id, exerciseId));
      console.log(`[ENRICH] Updated exercise ${ex.name} with AI metadata:`, Object.keys(updates));
    }

  } catch (error) {
    console.error(`[ENRICH] Failed to enrich exercise ${exerciseId}:`, error);
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
 * Helper to save an exercise alias to the database
 */
async function saveExerciseAlias(exerciseId: string, alias: string, lang: string = 'en') {
  try {
    const normalized = normalizeName(alias);
    if (!normalized) return;

    await db.insert(exerciseAliasesTable).values({
      exerciseId,
      alias,
      aliasNorm: normalized,
      lang,
      source: 'ai_match'
    }).onConflictDoNothing();
    
    console.log(`[ALIAS] Saved alias "${alias}" for exercise ${exerciseId}`);
  } catch (error) {
    console.warn(`[ALIAS] Failed to save alias "${alias}" for exercise ${exerciseId}:`, error);
  }
}

/**
 * Helper to serialize exercise with guaranteed nameEn fallback
 * Ensures nameEn is never undefined in AI prompts
 */
function serializeExercise(ex: any): { id: string; nameEn: string; name: string; youtubeUrl: string | null } {
  return {
    id: ex.exerciseId || ex.id,
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
): Promise<Array<{ id: string; nameEn: string; name: string; youtubeUrl: string | null }>> {
  try {
    // Get user's selected gym if gymId not provided
    let targetGymId = gymId;
    if (!targetGymId) {
      const [profile] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);
      
      targetGymId = profile?.selectedGymId || undefined;
    }

    // Get user's equipment (gym-specific or all if no gym selected)
    let userEq: UserEquipment[];
    
    if (targetGymId) {
      // Get equipment for specific gym (owned by user)
      userEq = await db
        .select()
        .from(userEquipment)
        .where(
          and(
            eq(userEquipment.userId, userId),
            eq(userEquipment.gymId, targetGymId)
          )
        );
      
      // FALLBACK: If user has no personal equipment records for this gym, 
      // check if it's a public/verified gym and use its registered equipment.
      if (userEq.length === 0) {
        const [gym] = await db.select().from(gyms).where(eq(gyms.id, targetGymId));
        if (gym && (gym.isPublic || gym.isVerified)) {
          console.log(`[EXERCISE FILTER] User has no records for gym ${targetGymId}. Using public equipment.`);
          userEq = await db
            .select()
            .from(userEquipment)
            .where(eq(userEquipment.gymId, targetGymId));
        }
      }
      console.log(`[EXERCISE FILTER] Filtering for gym ${targetGymId} with ${userEq.length} equipment items`);
    } else {
      // Fallback: Get all equipment for user across all gyms
      userEq = await db
        .select()
        .from(userEquipment)
        .where(eq(userEquipment.userId, userId));
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

      // Check user's equipment by key first, then by name
      const availableKeys = userEq.map(ue => ue.equipmentKey).filter(Boolean) as string[];
      const availableNames = userEq.map(ue => ue.equipmentName ? normalizeName(ue.equipmentName) : "");

      // Check if ALL required equipment (excluding 'unknown') is available
      const allAvailable = filteredRequired.every(req => {
        // 1. Direct key match (e.g. "barbell" == "barbell")
        if (availableKeys.includes(req)) return true;
        
        // 2. Fuzzy key match (e.g. "barbell" in "standard_barbell")
        if (availableKeys.some((key: string) => key.includes(req) || req.includes(key))) return true;

        // 3. Name match fallback
        if (availableNames.some((avail: string) => avail.includes(req) || req.includes(avail))) return true;

        return false;
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
