import type { UserProfile, UserEquipment } from "@shared/schema";
import { enrichExerciseMetadata, normalizeMetadataValue } from "./exercise-matcher";
import { z } from "zod";
import OpenAI from "openai";
import * as V4Prompts from "./prompts/v4";
import { estimateSessionSeconds, fitProgramSessions } from "./utils/timeFitting";
import { storage } from "./storage";
import { JobManager } from "./generation-jobs";

// OpenAI client
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "missing"
});

// DeepSeek client
const deepseek = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  apiKey: process.env.AI_INTEGRATIONS_DEEPSEEK_API_KEY || "missing"
});

// Gemini client
const gemini = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "missing"
});

// Provider priority: DeepSeek (cheapest) → Gemini → OpenAI (most expensive)
const DEFAULT_PROVIDER_PRIORITY = ["gemini", "deepseek", "openai"];
const PROVIDER_PRIORITY = (process.env.AI_PROVIDER_PRIORITY || DEFAULT_PROVIDER_PRIORITY.join(","))
  .split(",")
  .map(p => p.trim().toLowerCase());

console.log(`[AI PROVIDER] Priority order: ${PROVIDER_PRIORITY.join(" → ")}`);

// V4 logic is now the standard system. 
// V1, V2, and V3 have been removed as per user request.

// Schema for DeepSeek Workout Program (Frontend-compatible format)
const weeklySessionSchema = z.object({
  session_number: z.number(),
  week_number: z.number().optional(),
  weekday: z.string().optional(),
  session_name: z.string(),
  muscle_focus: z.string().optional(),
  session_type: z.string(),
  estimated_duration_minutes: z.number(),
  warmup: z.array(z.object({
    exercise_name: z.string(),
    sets: z.number(),
    reps_or_duration: z.string(),
    notes: z.string(),
  })),
  main_work: z.array(z.object({
    exercise_name: z.string(),
    sets: z.number(),
    reps: z.string(),
    rest_seconds: z.number(),
    tempo: z.string(),
    suggested_weight_kg: z.number().nullable(),
    suggested_weight_notes: z.string().nullable(),
    target_muscles: z.array(z.string()),
    required_equipment: z.array(z.string()),
    technique_cues: z.array(z.string()),
    category: z.string().optional(),
    primary_muscles: z.array(z.string()).optional(),
    secondary_muscles: z.array(z.string()).optional(),
    difficulty: z.string().optional(),
  })),
  cooldown: z.array(z.object({
    exercise_name: z.string(),
    duration_or_reps: z.string(),
    notes: z.string(),
  })),
});

const deepSeekWorkoutProgramSchema = z.object({
  user_profile: z.object({
    gender: z.string(),
    age: z.number(),
    weight_kg: z.number(),
    height_cm: z.number(),
    training_level: z.string(),
    main_goal: z.string(),
    distribution: z.object({
      strength_percent: z.number(),
      hypertrophy_percent: z.number(),
      endurance_percent: z.number(),
      cardio_percent: z.number(),
    }),
    sessions_per_week: z.number(),
    session_length_minutes: z.number(),
    available_equipment: z.array(z.string()),
  }),
  program_overview: z.object({
    week_focus_summary: z.string(),
    expected_difficulty: z.string(),
    notes_on_progression: z.string(),
  }),
  weekly_sessions: z.array(weeklySessionSchema),
});

export type DeepSeekWorkoutProgram = z.infer<typeof deepSeekWorkoutProgramSchema>;
export { deepSeekWorkoutProgramSchema };

// Schema for V4 Analysis Step A
const v4AnalysisSchema = z.object({
  analysis_summary: z.string(),
  focus_distribution: z.object({
    strength: z.number(),
    hypertrophy: z.number(),
    endurance: z.number(),
    cardio: z.number(),
  }),
  recommendations: z.object({
    sets_per_session_min: z.number(),
    sets_per_session_max: z.number(),
    weekly_volume_sets_min: z.number(),
    weekly_volume_sets_max: z.number(),
  }),
});

export type V4Analysis = z.infer<typeof v4AnalysisSchema>;

// Schema for V4 Blueprint Step B (IDs-only)
const v4BlueprintSchema = z.object({
  program_name: z.string(),
  duration_weeks: z.number(),
  sessions: z.array(z.object({
    session_index: z.number(),
    week_number: z.number().optional(),
    weekday: z.string(),
    name: z.string(),
    blocks: z.array(z.object({
      type: z.enum(["warmup", "main", "accessory", "cardio", "cooldown", "endurance", "core"]),
      exercises: z.array(z.object({
        exercise_id: z.string(),
        exercise_name: z.string().optional(),
        sets: z.number(),
        reps: z.string(),
        rest_seconds: z.number().nullable(),
        load_type: z.string(),
        load_value: z.number().nullable(),
        priority: z.number().min(1).max(3),
        notes: z.string().nullable(),
        category: z.string().optional(),
        required_equipment: z.array(z.string()).optional(),
        primary_muscles: z.array(z.string()).optional(),
        secondary_muscles: z.array(z.string()).optional(),
        difficulty: z.string().optional(),
      }))
    }))
  }))
});

export type V4Blueprint = z.infer<typeof v4BlueprintSchema>;

/**
 * Translate muscle focus strings to Swedish
 */
// Helper to translate session focus/name
function translateSessionName(name: string | null | undefined): string {
  if (!name) return "Helskropp Styrka";
  
  const MAPPINGS: Record<string, string> = {
    'Upper Body': 'Överkropp',
    'Lower Body': 'Underkropp',
    'Full Body': 'Helskropp',
    'Push': 'Press',
    'Pull': 'Drag',
    'Legs': 'Ben',
    'Strength': 'Styrka',
    'Hypertrophy': 'Muskeltillväxt',
    'Power': 'Explosivitet',
    'Conditioning': 'Kondition',
    'Endurance': 'Uthållighet',
    'Core': 'Bål',
    'Focus': 'Fokus',
    'Accessory': 'Komplement',
    'Explosive': 'Explosiv'
  };
  
  let translated = name;
  for (const [eng, swe] of Object.entries(MAPPINGS)) {
    const regex = new RegExp(`\\b${eng}\\b`, 'gi');
    translated = translated.replace(regex, swe);
  }

  // Strip Week prefix if it exists (e.g. "Vecka 1: ", "Week 1: ")
  translated = translated.replace(/^(Vecka|Week)\s+\d+:?\s*/i, '');

  return translated;
}

/**
 * Maps Swedish training levels to English for AI analysis
 */
function mapTrainingLevelToEnglish(level: string | null | undefined): string {
  if (!level) return "intermediate";
  
  const MAPPINGS: Record<string, string> = {
    'nyborjare': 'beginner',
    'nybörjare': 'beginner',
    'van': 'intermediate',
    'mycket_van': 'advanced',
    'mycket van': 'advanced',
    'elit': 'elite'
  };
  
  const normalized = level.toLowerCase().trim();
  return MAPPINGS[normalized] || normalized;
}

/**
 * Hydrate V4 Blueprint into standard format for frontend compatibility
 */
async function hydrateV4Blueprint(
  blueprint: V4Blueprint, 
  profile: any,
  timeModel: any
): Promise<AIWorkoutProgram> {
  const exerciseIds = new Set<string>();
  blueprint.sessions.forEach(s => s.blocks.forEach(b => b.exercises.forEach(e => exerciseIds.add(e.exercise_id))));
  
  const catalogExercises = await storage.getExercisesByIds(Array.from(exerciseIds));
  const catalogMap = new Map<string, any>();
  catalogExercises.forEach(ex => {
    if (ex.exerciseId) catalogMap.set(ex.exerciseId, ex);
    if (ex.id) catalogMap.set(ex.id, ex);
  });

  const equipmentCatalog = await storage.getEquipmentCatalog();
  const eqMap = new Map<string, string>();
  equipmentCatalog.forEach(eq => {
    if (eq.equipmentKey) eqMap.set(eq.equipmentKey, eq.name || eq.nameEn || eq.equipmentKey);
  });

  const weeklySessions = blueprint.sessions.map(s => {
    const warmup: any[] = [];
    const main_work: any[] = [];
    const cooldown: any[] = [];

    s.blocks.forEach(block => {
      block.exercises.forEach(ex => {
        const cat = catalogMap.get(ex.exercise_id);
        if (!cat) {
          console.warn(`[V4 HYDRATION] ⚠️ Exercise ID "${ex.exercise_id}" not found in catalog!`);
        } else {
          // Auto-enrich existing exercise if catalog data is missing
          // This is a "fire-and-forget" background operation
          enrichExerciseMetadata(cat.id, {
            primaryMuscles: ex.primary_muscles,
            secondaryMuscles: ex.secondary_muscles,
            equipment: ex.required_equipment
          });
        }
        
        // Localization: Return English name or ID (Client handles localization)
        const exerciseName = cat?.nameEn || cat?.name || ex.exercise_id;
        
        // Return raw equipment IDs (Client handles localization)
        const rawEq = cat?.requiredEquipment || ex.required_equipment || [];
        const localizedEq = rawEq; // Pass through raw IDs (e.g. 'dumbbells', 'trap_bar')

        const hydratedEx = {
          exercise_name: exerciseName,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds ?? timeModel.restBetweenSetsSeconds,
          tempo: "3-0-1-0",
          suggested_weight_kg: null,
          suggested_weight_notes: null,
          target_muscles: cat?.primaryMuscles || ex.primary_muscles || [],
          required_equipment: localizedEq,
          technique_cues: cat?.description ? [cat.description] : [],
          category: ex.category || cat?.category,
          primary_muscles: ex.primary_muscles || cat?.primaryMuscles,
          secondary_muscles: ex.secondary_muscles || cat?.secondaryMuscles,
          difficulty: ex.difficulty || cat?.difficulty,
        };

        if (block.type === "warmup") {
          warmup.push({
            exercise_name: hydratedEx.exercise_name,
            sets: ex.sets,
            reps_or_duration: ex.reps,
            notes: ex.notes || "",
          });
        } else if (block.type === "cooldown") {
          cooldown.push({
            exercise_name: hydratedEx.exercise_name,
            duration_or_reps: ex.reps,
            notes: ex.notes || "",
          });
        } else {
          main_work.push({
            ...hydratedEx,
          });
        }
      });
    });

    const sessionDurationSeconds = estimateSessionSeconds(s as any, timeModel);

    return {
      session_number: s.session_index,
      week_number: (s as any).week_number || 1,
      weekday: s.weekday,
      session_name: translateSessionName(s.name),
      muscle_focus: translateSessionName(s.name), // Attempt to translate focus from name or metadata
      session_type: "strength",
      estimated_duration_minutes: Math.ceil(sessionDurationSeconds / 60),
      warmup,
      main_work,
      cooldown,
    };
  });

  return {
    user_profile: {
      gender: profile.sex || "not_specified",
      age: profile.age || 30,
      weight_kg: profile.bodyWeight || 75,
      height_cm: profile.height || 175,
      training_level: profile.trainingLevel || "intermediate",
      main_goal: profile.trainingGoals || "general_fitness",
      distribution: {
        strength_percent: profile.goalStrength || 25,
        hypertrophy_percent: profile.goalVolume || 25,
        endurance_percent: profile.goalEndurance || 25,
        cardio_percent: profile.goalCardio || 25,
      },
      sessions_per_week: profile.sessionsPerWeek || 3,
      session_length_minutes: 60,
      available_equipment: (profile.equipmentList || "").split(",").filter(Boolean),
    },
    program_overview: {
      week_focus_summary: "Localized Workout Program",
      focus_distribution: {
        strength: 25,
        hypertrophy: 25,
        endurance: 25,
        cardio: 25
      }
    },
    weekly_sessions: weeklySessions,
  };
}

// Response structure for AI-generated programs
export interface AIWorkoutProgram {
  user_profile: any;
  program_overview: any;
  weekly_sessions: any[];
}

// Helper to get configuration for a specific provider name
function getClientConfig(provider: string): { client: OpenAI; provider: string; model: string } | null {
  const p = provider.toLowerCase().trim();
  if (p === "deepseek" && process.env.AI_INTEGRATIONS_DEEPSEEK_API_KEY) {
    return { client: deepseek, provider: "DeepSeek", model: "deepseek-chat" };
  }
  if (p === "gemini" && process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
    const model = process.env.AI_GEMINI_MODEL || "gemini-2.0-flash-exp";
    return { client: gemini, provider: "Gemini", model: model };
  }
  if (p === "openai" && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return { client: openai, provider: "OpenAI", model: "gpt-4o" };
  }
  return null;
}

// Execute an AI request with fallback to other providers
async function executeWithFallback(
  messages: any[],
  responseFormat: any,
  logPrefix: string
): Promise<{ content: string; provider: string }> {
  let lastError: any;
  const attemptedProviders: string[] = [];

  for (const providerName of PROVIDER_PRIORITY) {
    const config = getClientConfig(providerName);
    if (!config) continue;
    
    try {
      console.log(`[${logPrefix}] 🔄 Attempting generation with ${config.provider} (${config.model})...`);
      const timeoutMs = 45000; 
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
      });

      const apiPromise = config.client.chat.completions.create({
        model: config.model,
        messages,
        response_format: responseFormat,
      });
      
      const response = await Promise.race([apiPromise, timeoutPromise]) as any;
      const content = (response.choices[0].message.content || "{}").trim();
      
      const preview = content.length > 100 ? content.substring(0, 100) + "..." : content;
      console.log(`[${logPrefix}] ✅ Success with ${config.provider}. Content: ${preview}`);
      return { content, provider: config.provider };
      
    } catch (error: any) {
      console.warn(`[${logPrefix}] ⚠️ ${config.provider} failed: ${error.message}`);
      lastError = error;
      attemptedProviders.push(config.provider);
    }
  }

  throw lastError || new Error("No AI providers available");
}

/**
 * Helper to clean AI response and parse JSON safely
 */
function safeParseJSON(content: string, logPrefix: string): any {
  let cleaned = content.trim();
  
  // 1. Remove markdown code blocks
  if (cleaned.includes("```")) {
    const matches = cleaned.match(/```(?:json)?([\s\S]*?)```/);
    if (matches && matches[1]) {
      cleaned = matches[1].trim();
    } else {
      cleaned = cleaned.replace(/```(?:json)?/g, "").replace(/```/g, "").trim();
    }
  }

  // 2. Try parsing directly
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // 3. Last ditch effort: find first { and last }
    console.warn(`[${logPrefix}] ⚠️ Direct parse failed, attempting block extraction...`);
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const extracted = cleaned.substring(start, end + 1);
        return JSON.parse(extracted);
      } catch (innerError) {
        console.error(`[${logPrefix}] ❌ Extraction failed. Raw content:`, content);
        throw innerError;
      }
    }
    console.error(`[${logPrefix}] ❌ No JSON object found. Raw content:`, content);
    throw e;
  }
}

/**
 * Main V4 generation flow
 */
// Helper to translate session focus names

export async function generateWorkoutProgramV4WithOpenAI(
  profileData: any,
  targetDuration: number,
  jobId?: string
): Promise<DeepSeekWorkoutProgram> {
  console.log(`[V4] Starting V4 generation flow`);
  console.log(`[V4] Priority: ${PROVIDER_PRIORITY.join(" → ")}`);
  const englishLevel = mapTrainingLevelToEnglish(profileData.trainingLevel);
  console.log(`[V4] Training level: "${profileData.trainingLevel}" -> English: "${englishLevel}"`);
  
  // Step A: Analysis
  const analysisResult = await executeWithFallback(
    [
      { role: "system", content: V4Prompts.buildAnalysisSystemPromptV4() },
      { role: "user", content: V4Prompts.buildAnalysisUserPromptV4({
        user: {
          age: profileData.age,
          sex: profileData.sex,
          weight_kg: profileData.bodyWeight,
          height_cm: profileData.height,
          training_level: mapTrainingLevelToEnglish(profileData.trainingLevel),
          primary_goal: profileData.trainingGoals,
          sport: profileData.specificSport,
        }
      }) }
    ],
    { type: "json_object" },
    "V4 Analysis"
  );

  const analysis = v4AnalysisSchema.parse(safeParseJSON(analysisResult.content, "V4 Analysis"));
  console.log(`[V4] Analysis complete: ${analysis.analysis_summary}`);
  
  if (jobId) JobManager.updateJob(jobId, { progress: 30 });

  // Step B: Blueprint
  const timeModel = await storage.getUserTimeModel(profileData.userId) || {
    workSecondsPer10Reps: 30,
    restBetweenSetsSeconds: 90,
    restBetweenExercisesSeconds: 120,
    warmupMinutesDefault: 8,
    cooldownMinutesDefault: 5,
  };

  const pools = await storage.getCandidatePools(profileData.userId, profileData.selectedGymId);
  const candidatePools: V4Prompts.V4CandidatePools = {};
  pools.forEach(p => Object.assign(candidatePools, p.buckets));

  // Fetch active prompts from DB or fallback
  const dbPromptV4 = await storage.getActiveAiPrompt("v4-system");
  const dbPromptV4_5 = await storage.getActiveAiPrompt("v4.5-system");
  const systemPromptV4 = dbPromptV4 ? dbPromptV4.content : V4Prompts.buildBlueprintSystemPromptV4();
  const systemPromptV4_5 = dbPromptV4_5 ? dbPromptV4_5.content : V4Prompts.buildBlueprintSystemPromptV4_5();

  const blueprintResult = await executeWithFallback(
    [
      { role: "system", content: ((profileData.sessionsPerWeek || 3) <= 3) ? systemPromptV4_5 : systemPromptV4 },
      { role: "user", content: V4Prompts.buildBlueprintUserPromptV4({
        schedule: {
          sessions_per_week: profileData.sessionsPerWeek || 3,
          target_minutes: targetDuration,
          allowed_duration_minutes: { min: targetDuration - 10, max: targetDuration + 10 },
          weekdays: (profileData.weekdayList || "Monday,Wednesday,Friday").split(","),
        },
        focus_distribution: analysis.focus_distribution,
        sport: profileData.specificSport,
        time_model: {
          work_seconds_per_10_reps: timeModel.workSecondsPer10Reps,
          rest_between_sets_seconds: timeModel.restBetweenSetsSeconds,
          rest_between_exercises_seconds: timeModel.restBetweenExercisesSeconds,
          warmup_minutes_default: timeModel.warmupMinutesDefault || 8,
          cooldown_minutes_default: timeModel.cooldownMinutesDefault || 5,
        },
        candidate_pools: candidatePools,
      }) }
    ],
    { type: "json_object" },
    "V4 Blueprint"
  );

  const blueprint = v4BlueprintSchema.parse(safeParseJSON(blueprintResult.content, "V4 Blueprint"));
  console.log(`[V4] Blueprint created: ${blueprint.program_name}`);

  if (jobId) JobManager.updateJob(jobId, { progress: 60 });

  // Step C: Hydration & Fitting
  const fitResults = fitProgramSessions({
    sessions: blueprint.sessions as any,
    cfg: timeModel as any,
    targetMinutes: targetDuration,
    allowedMinMinutes: targetDuration - 5,
    allowedMaxMinutes: targetDuration + 5,
  });

  blueprint.sessions = fitResults.sessions as any;
  const hydrated = await hydrateV4Blueprint(blueprint, profileData, timeModel);
  console.log(`[V4] Hydration and fitting complete`);
  
  return hydrated;
}

/**
 * Generate just the blueprint (IDs)
 */
export async function generateWorkoutBlueprintV4WithOpenAI(
  profileData: any,
  targetDuration: number
): Promise<V4Blueprint> {
  console.log(`[V4] Starting Blueprint-only generation`);
  const englishLevel = mapTrainingLevelToEnglish(profileData.trainingLevel);
  console.log(`[V4] Training level: "${profileData.trainingLevel}" -> English: "${englishLevel}"`);
  
  // Step A: Analysis
  const analysisResult = await executeWithFallback(
    [
      { role: "system", content: V4Prompts.buildAnalysisSystemPromptV4() },
      { role: "user", content: V4Prompts.buildAnalysisUserPromptV4({
        user: {
          age: profileData.age,
          sex: profileData.sex,
          weight_kg: profileData.bodyWeight,
          height_cm: profileData.height,
          training_level: mapTrainingLevelToEnglish(profileData.trainingLevel),
          primary_goal: profileData.trainingGoals,
          sport: profileData.specificSport,
        }
      }) }
    ],
    { type: "json_object" },
    "V4 Analysis"
  );

  const analysis = v4AnalysisSchema.parse(safeParseJSON(analysisResult.content, "V4 Analysis"));
  
  // Step B: Blueprint
  const timeModel = await storage.getUserTimeModel(profileData.userId) || {
    workSecondsPer10Reps: 30,
    restBetweenSetsSeconds: 90,
    restBetweenExercisesSeconds: 120,
    warmupMinutesDefault: 8,
    cooldownMinutesDefault: 5,
  };

  const pools = await storage.getCandidatePools(profileData.userId, profileData.selectedGymId);
  const candidatePools: V4Prompts.V4CandidatePools = {};
  pools.forEach(p => Object.assign(candidatePools, p.buckets));

  // Fetch prompts from DB or fallback
  const dbPromptV4B = await storage.getAiPrompt("v4-blueprint-system");
  const dbPromptV4_5B = await storage.getAiPrompt("v4.5-blueprint-system");
  const sysV4B = dbPromptV4B ? dbPromptV4B.content : V4Prompts.buildBlueprintSystemPromptV4();
  const sysV4_5B = dbPromptV4_5B ? dbPromptV4_5B.content : V4Prompts.buildBlueprintSystemPromptV4_5();

  const blueprintResult = await executeWithFallback(
    [
      { role: "system", content: ((profileData.sessionsPerWeek || 3) <= 3) ? sysV4_5B : sysV4B },
      { role: "user", content: V4Prompts.buildBlueprintUserPromptV4({
        schedule: {
          sessions_per_week: profileData.sessionsPerWeek || 3,
          target_minutes: targetDuration,
          allowed_duration_minutes: { min: targetDuration - 10, max: targetDuration + 10 },
          weekdays: (profileData.weekdayList || "Monday,Wednesday,Friday").split(","),
        },
        focus_distribution: analysis.focus_distribution,
        sport: profileData.specificSport,
        time_model: {
          work_seconds_per_10_reps: timeModel.workSecondsPer10Reps,
          rest_between_sets_seconds: timeModel.restBetweenSetsSeconds,
          rest_between_exercises_seconds: timeModel.restBetweenExercisesSeconds,
          warmup_minutes_default: timeModel.warmupMinutesDefault || 8,
          cooldown_minutes_default: timeModel.cooldownMinutesDefault || 5,
        },
        candidate_pools: candidatePools,
      }) }
    ],
    { type: "json_object" },
    "V4 Blueprint"
  );

  const blueprint = v4BlueprintSchema.parse(safeParseJSON(blueprintResult.content, "V4 Blueprint"));
  
  // Fit sessions
  const fitResults = fitProgramSessions({
    sessions: blueprint.sessions as any,
    cfg: timeModel as any,
    targetMinutes: targetDuration,
    allowedMinMinutes: targetDuration - 5,
    allowedMaxMinutes: targetDuration + 5,
  });

  blueprint.sessions = fitResults.sessions as any;

  // Hydrate exercise names for the blueprint return type
  const exerciseIds = new Set<string>();
  blueprint.sessions.forEach(s => s.blocks.forEach(b => b.exercises.forEach(e => exerciseIds.add(e.exercise_id))));
  const catalogExercises = await storage.getExercisesByIds(Array.from(exerciseIds));
  const catalogMap = new Map<string, any>();
  catalogExercises.forEach(ex => {
    if (ex.exerciseId) catalogMap.set(ex.exerciseId, ex);
    if (ex.id) catalogMap.set(ex.id, ex);
  });

  blueprint.sessions.forEach(s => {
    s.blocks.forEach(b => {
      b.exercises.forEach(ex => {
        const cat = catalogMap.get(ex.exercise_id);
        ex.exercise_name = cat?.name || cat?.nameEn || ex.exercise_id;
      });
    });
  });

  return blueprint;
}

/**
 * Main entry point for workout generation. 
 * Routes everything to V4, handling legacy signatures.
 */
export async function generateWorkoutProgramWithVersionSwitch(
  arg1: any, 
  arg2?: any,
  arg3?: any,
  arg4?: any,
  jobId?: string
): Promise<AIWorkoutProgram> {
  let profileData: any;
  let targetDuration: number = 60;

  if (typeof arg1 === 'string' && typeof arg2 === 'string') {
    // Signature: (systemPrompt, userPrompt, targetDuration, profileData)
    targetDuration = arg3 || 60;
    profileData = arg4;
  } else {
    // Signature: (profile, equipment) or similar
    profileData = arg1;
    if (arg2 && Array.isArray(arg2)) {
      // If equipment array is provided, ensure it's in the profileData for V4
      profileData.equipmentList = arg2.map((e: any) => e.equipmentName || e.name || e).join(",");
    }
  }

  return await generateWorkoutProgramV4WithOpenAI(profileData, targetDuration, jobId);
}

// Aliases for backward compatibility
export const generateWorkoutProgram = generateWorkoutProgramWithVersionSwitch;
export const generateWorkoutProgramWithReasoner = generateWorkoutProgramWithVersionSwitch;
