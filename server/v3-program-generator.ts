/**
 * V3 Workout Program Generator Helper
 * Consolidated entry point for V3 AI program generation
 * Replaces the version-switching logic from ai-service.ts
 */

import { analyzeUserProfile, createWorkoutProgram, mapOnboardingToV3Profile, type ProgramResult, type AnalysisResult } from "./ai-service-v3";
// Note: filterExercisesByUserEquipment removed - we now do post-validation instead of pre-filtering
import { storage } from "./storage";

export interface GenerateV3ProgramInput {
  userId: string;
  profile: {
    age?: number;
    sex?: string;
    bodyWeight?: number;
    height?: number;
    trainingLevel?: string;
    motivationType?: string;
    trainingGoals?: string;
    specificSport?: string;
    oneRmBench?: number | null;
    oneRmOhp?: number | null;
    oneRmDeadlift?: number | null;
    oneRmSquat?: number | null;
    oneRmLatpull?: number | null;
    goalStrength?: number;
    goalVolume?: number;
    goalEndurance?: number;
    goalCardio?: number;
  };
  sessionsPerWeek: number;
  sessionDuration: number;
  equipmentList: string[];
  gymId?: string;
}

export interface GenerateV3ProgramResult {
  analysisResult: AnalysisResult;
  programResult: ProgramResult;
  // DeepSeek-compatible format for storage functions
  deepSeekFormat: {
    program_overview: {
      week_focus_summary: string;
      expected_difficulty: string;
      notes_on_progression: string;
    };
    weekly_sessions: Array<{
      session_number: number;
      session_name: string;
      estimated_duration_minutes: number;
      muscle_focus: string;
      warmup: any[];
      main_workout: Array<{
        exercise_name: string;
        sets: number;
        reps: string;
        rest_seconds: number;
        tempo: string;
        suggested_weight_kg: number | null;
        suggested_weight_notes: string;
        target_muscles: string[];
        required_equipment: string[];
        technique_cues: string[];
      }>;
      cooldown: any[];
    }>;
  };
}

/**
 * Generate a workout program using V3 AI architecture
 * This is the main entry point for all program generation
 */
export async function generateV3Program(input: GenerateV3ProgramInput): Promise<GenerateV3ProgramResult> {
  console.log("[V3 GENERATOR] Starting V3 program generation...");
  console.log("[V3 GENERATOR] User ID:", input.userId);
  console.log("[V3 GENERATOR] Sessions per week:", input.sessionsPerWeek);
  console.log("[V3 GENERATOR] Session duration:", input.sessionDuration);
  
  // Step 1: Map to V3 profile format
  console.log("[V3 GENERATOR] Step 1: Mapping profile to V3 format...");
  const v3Profile = mapOnboardingToV3Profile(input.profile);
  
  // Step 2: Run analysis to get 1RM estimates and focus distribution
  console.log("[V3 GENERATOR] Step 2: Analyzing user profile...");
  const analysisStartTime = Date.now();
  const analysisResult = await analyzeUserProfile(v3Profile);
  console.log(`[V3 GENERATOR] Analysis completed in ${Date.now() - analysisStartTime}ms`);
  
  // Use estimated 1RM if user didn't provide their own
  const confirmed1Rm = v3Profile.confirmed1Rm || {
    bench_press: analysisResult.estimated_1rm_kg.bench_press,
    overhead_press: analysisResult.estimated_1rm_kg.overhead_press,
    deadlift: analysisResult.estimated_1rm_kg.deadlift,
    squat: analysisResult.estimated_1rm_kg.squat,
    lat_pulldown: analysisResult.estimated_1rm_kg.lat_pulldown,
  };
  
  // Use focus distribution from analysis if not provided
  const focusDistribution = v3Profile.focusDistribution || analysisResult.focus_distribution;
  
  // Step 3: Create workout program
  // NOTE: We no longer pre-filter exercises. AI receives only equipment list.
  // Post-validation in storage.ts will ensure exercises match available equipment.
  console.log("[V3 GENERATOR] Step 3: Creating workout program...");
  const programStartTime = Date.now();
  
  const equipmentListStr = input.equipmentList.length > 0 
    ? input.equipmentList.join(", ") 
    : "Bodyweight only";
  
  console.log(`[V3 GENERATOR] Equipment list: ${equipmentListStr}`);
    
  const programResult = await createWorkoutProgram(
    {
      ...v3Profile,
      confirmed1Rm,
      focusDistribution,
    },
    {
      sessionsPerWeek: input.sessionsPerWeek,
      sessionDurationMinutes: input.sessionDuration,
      equipmentList: equipmentListStr,
      // filteredExerciseNames removed - post-validation handles equipment matching
    }
  );
  console.log(`[V3 GENERATOR] Program created in ${Date.now() - programStartTime}ms`);
  
  // Step 5: Convert to DeepSeek format for storage compatibility
  console.log("[V3 GENERATOR] Step 5: Converting to DeepSeek format...");
  const deepSeekFormat = {
    program_overview: {
      week_focus_summary: programResult.sport_specific_note || "Personalized workout program",
      expected_difficulty: v3Profile.trainingLevel || "Intermediate",
      notes_on_progression: "Program generated using V3 AI architecture",
    },
    weekly_sessions: programResult.schedule.map((day, index) => ({
      session_number: index + 1,
      session_name: day.day_name,
      estimated_duration_minutes: input.sessionDuration,
      muscle_focus: day.day_name,
      warmup: [],
      main_workout: day.exercises.map(ex => ({
        exercise_name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest_seconds: ex.rest_seconds,
        tempo: "",
        suggested_weight_kg: ex.calculated_weight,
        suggested_weight_notes: ex.load_guidance,
        target_muscles: [],
        required_equipment: [],
        technique_cues: ex.note ? [ex.note] : [],
      })),
      cooldown: [],
    })),
  };
  
  console.log("[V3 GENERATOR] ✅ V3 program generation complete!");
  
  return {
    analysisResult,
    programResult,
    deepSeekFormat,
  };
}
