import { db } from "./db";
import { exercises, unmappedExercises, exerciseAliases as exerciseAliasesTable, userProfiles, userEquipment, UserEquipment, gyms, equipmentCatalog } from "@shared/schema";
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
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9åäö\s]/g, '') // Keep Swedish chars
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .trim();
}

function slugifyExerciseId(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

const EQUIPMENT_KEY_SYNONYMS: Record<string, string> = {
  dumbbell: "dumbbells",
  dumbbells: "dumbbells",
  hantel: "dumbbells",
  hantlar: "dumbbells",
  barbell: "barbell",
  skivstang: "barbell",
  skivstång: "barbell",
  cable: "cable_machine",
  cables: "cable_machine",
  kabel: "cable_machine",
  kabelmaskin: "cable_machine",
  machine: "machine",
  maskin: "machine",
  bench: "flat_bench",
  bänk: "flat_bench",
  flat_bench: "flat_bench",
  adjustable_bench: "adjustable_bench",
  rack: "power_rack",
  power_rack: "power_rack",
  smith_machine: "smith_machine",
  resistance_band: "resistance_bands",
  resistance_bands: "resistance_bands",
  gummiband: "resistance_bands",
  kettlebell: "kettlebells",
  kettlebells: "kettlebells",
  bodyweight: "bodyweight",
  kroppsvikt: "bodyweight",
};

async function normalizeEquipmentKeys(values: string[] | undefined): Promise<string[]> {
  if (!values || values.length === 0) return ["bodyweight"];

  const catalog = await db
    .select({
      equipmentKey: equipmentCatalog.equipmentKey,
      name: equipmentCatalog.name,
      nameEn: equipmentCatalog.nameEn,
    })
    .from(equipmentCatalog);

  const byToken = new Map<string, string>();
  for (const row of catalog) {
    const key = (row.equipmentKey || "").trim();
    if (!key) continue;
    byToken.set(normalizeName(key), key);
    if (row.name) byToken.set(normalizeName(row.name), key);
    if (row.nameEn) byToken.set(normalizeName(row.nameEn), key);
  }

  const normalized: string[] = [];
  for (const raw of values) {
    const token = normalizeName(String(raw || ""));
    if (!token) continue;

    const direct = byToken.get(token);
    if (direct) {
      if (!normalized.includes(direct)) normalized.push(direct);
      continue;
    }

    const synonym = EQUIPMENT_KEY_SYNONYMS[token];
    if (synonym) {
      if (!normalized.includes(synonym)) normalized.push(synonym);
      continue;
    }
  }

  return normalized.length > 0 ? normalized : ["bodyweight"];
}

function toCoreName(name: string): string {
  const stopWords = new Set([
    "på", "med", "och", "för", "i", "av", "the", "with", "and", "for", "on", "in",
    "maskin", "machine", "kabelmaskin", "cable", "stationär", "stående", "sittande",
    "seated", "standing", "lying", "barbell", "dumbbell", "ez", "stång"
  ]);
  return normalizeName(name)
    .split(" ")
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .join(" ")
    .trim();
}

function tokenOverlapRatio(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let common = 0;
  for (const token of Array.from(aTokens)) {
    if (bTokens.has(token)) common += 1;
  }
  return common / Math.min(aTokens.size, bTokens.size);
}

function looksLikeExerciseId(value: string): boolean {
  const candidate = (value || "").trim();
  if (!candidate) return false;

  const uuidLike = /^[0-9a-f]{8}[-\s][0-9a-f]{4}[-\s][0-9a-f]{4}[-\s][0-9a-f]{4}[-\s][0-9a-f]{12}$/i;
  if (uuidLike.test(candidate)) return true;

  const compact = candidate.replace(/[^0-9a-f]/gi, "");
  const compactNoSpace = candidate.replace(/\s+/g, "");
  if (compact.length >= 24 && compact.length === compactNoSpace.length) return true;

  return false;
}

function looksLikePlaceholderExerciseCode(value: string): boolean {
  const candidate = (value || "").trim();
  if (!candidate) return false;

  // Common LLM placeholder tokens seen in failed generations, e.g. E101, E202, E013.
  if (/^e\d{2,5}$/i.test(candidate)) return true;

  // Generic short alpha+digits code (2-8 chars) like X12, A203, Z9999.
  if (/^[a-z]{1,2}\d{2,5}$/i.test(candidate)) return true;

  return false;
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

  if (looksLikePlaceholderExerciseCode(aiGeneratedName)) {
    await logUnmappedExercise(aiGeneratedName, "Rejected: Placeholder exercise code", metadata);
    return {
      matched: false,
      exerciseName: null,
      exerciseId: null,
      confidence: 'none',
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

  // Step 3: Try fuzzy matching (Levenshtein + core-word overlap) - ENGLISH ONLY
  const allExercises = await db
    .select()
    .from(exercises)
    .where(sql`${exercises.nameEn} IS NOT NULL`); // Only exercises with English names
  
  let bestMatch: typeof allExercises[0] | null = null;
  let bestDistance = Infinity;
  const coreInput = toCoreName(aiGeneratedName);

  for (const exercise of allExercises) {
    // Match against English name (nameEn guaranteed to exist)
    const normalizedExercise = normalizeName(exercise.nameEn!);
    const coreExercise = toCoreName(exercise.nameEn!);
    const distanceEnglish = levenshteinDistance(normalized, normalizedExercise);
    const distanceCore = coreInput && coreExercise
      ? levenshteinDistance(coreInput, coreExercise)
      : Number.MAX_SAFE_INTEGER;
    const overlap = coreInput && coreExercise ? tokenOverlapRatio(coreInput, coreExercise) : 0;

    const maxLength = Math.max(normalized.length, normalizedExercise.length);
    const dynamicThreshold = Math.max(3, Math.floor(maxLength * 0.2));
    const bestCandidateDistance = Math.min(distanceEnglish, distanceCore);
    const overlapAccepted = overlap >= 0.75;

    if ((bestCandidateDistance <= dynamicThreshold || overlapAccepted) && bestCandidateDistance < bestDistance) {
      bestDistance = bestCandidateDistance;
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

  // Step 4: No match found - always log for admin review (no auto-create)
  const suggestedReason = looksLikeExerciseId(aiGeneratedName)
    ? "Rejected: Name looks like ID/UUID"
    : null;
  console.log(`[MATCHER] No match found for "${aiGeneratedName}", logging unmapped`);
  await logUnmappedExercise(aiGeneratedName, suggestedReason, metadata);
  
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
    const generatedExerciseId = slugifyExerciseId(aiGeneratedName);
    const [newExercise] = await db.insert(exercises).values({
      exerciseId: generatedExerciseId || undefined,
      name: aiGeneratedName, // Use English name as primary name for new entries
      nameEn: aiGeneratedName, // CRITICAL: Always populate nameEn
      category: 'Strength', // Default category
      difficulty: 'intermediate',
      primaryMuscles: ['unknown'], // Placeholder
      secondaryMuscles: [],
      requiredEquipment: ['bodyweight'], // Always store canonical equipment keys
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
       updates.requiredEquipment = await normalizeEquipmentKeys(metadata.equipment);
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
    if (looksLikePlaceholderExerciseCode(alias)) return;

    const [exercise] = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(or(eq(exercises.id, exerciseId), eq(exercises.exerciseId, exerciseId)))
      .limit(1);

    if (!exercise) {
      console.warn(`[ALIAS] Exercise not found while saving alias "${alias}" for ${exerciseId}`);
      return;
    }

    // Keep aliases linked to UUID PK so both legacy and FK-enforced DBs work.
    const canonicalExerciseRef = exercise.id;

    try {
      // Prefer legacy-compatible insert (fills both alias_name + alias when column exists).
      await db.execute(sql`
        INSERT INTO exercise_aliases (exercise_id, alias_name, alias, alias_norm, lang, source)
        VALUES (${canonicalExerciseRef}, ${alias}, ${alias}, ${normalized}, ${lang}, 'ai_match')
        ON CONFLICT (alias_norm) DO NOTHING
      `);
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      const missingAliasNameColumn =
        message.includes("column") &&
        message.includes("alias_name") &&
        message.includes("does not exist");

      if (!missingAliasNameColumn) {
        throw error;
      }

      // Modern schema path (no alias_name column).
      await db.insert(exerciseAliasesTable).values({
        exerciseId: canonicalExerciseRef,
        alias,
        aliasNorm: normalized,
        lang,
        source: 'ai_match'
      }).onConflictDoNothing();
    }
    
    console.log(`[ALIAS] Saved alias "${alias}" for exercise ${canonicalExerciseRef}`);
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
