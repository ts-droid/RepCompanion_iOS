/**
 * AI Service V3 - Structured 3-Step Architecture
 * Step 1: Analysis & 1RM Estimation
 * Step 2: Program Creation
 * Step 3: Exercise Swap
 */

import { callAIProvider, parseAIJSONResponse, type AIResponse } from "./ai-providers";
import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt,
  buildProgramSystemPrompt,
  buildProgramUserPrompt,
  buildSwapSystemPrompt,
  buildSwapUserPrompt,
  AI_API_CONFIG,
  type UserProfile,
  type LogisticsContext,
  type SwapContext,
} from "./ai-prompts-v3";

// --------------------------------------------------------
// DATA MAPPING HELPERS
// --------------------------------------------------------

/**
 * Map onboarding profile data to V3 UserProfile format
 */
export function mapOnboardingToV3Profile(profile: any): UserProfile {
  // Map training level from Swedish to English
  const levelMap: Record<string, string> = {
    'nybörjare': 'Beginner',
    'van': 'Intermediate',
    'mycket_van': 'Advanced',
    'elit': 'Elite',
    'beginner': 'Beginner',
    'intermediate': 'Intermediate',
    'advanced': 'Advanced',
    'elite': 'Elite',
  };
  
  // Map motivation type to primary goal
  const goalMap: Record<string, string> = {
    'fitness': 'Build Muscle',
    'viktminskning': 'Weight Loss',
    'rehabilitering': 'Rehabilitation',
    'hälsa_livsstil': 'Health & Lifestyle',
    'bättre_hälsa': 'Health & Lifestyle',
    'bygga_muskler': 'Build Muscle',
    'hypertrofi': 'Build Muscle',
    'sport': 'Sport',
    'bli_rörligare': 'Mobility',
    'styrka': 'Strength',
    'estetik': 'Build Muscle',
  };
  
  // Map sex from Swedish to English
  const sexMap: Record<string, string> = {
    'man': 'Man',
    'kvinna': 'Woman',
    'male': 'Man',
    'female': 'Woman',
    'woman': 'Woman',
  };
  
  return {
    age: profile.age,
    sex: profile.sex ? sexMap[profile.sex.toLowerCase()] || profile.sex : undefined,
    bodyWeight: profile.bodyWeight,
    height: profile.height,
    trainingLevel: profile.trainingLevel ? levelMap[profile.trainingLevel.toLowerCase()] || profile.trainingLevel : undefined,
    primaryGoal: profile.motivationType ? goalMap[profile.motivationType.toLowerCase()] || profile.motivationType : undefined,
    specificSport: profile.specificSport,
    // Map 1RM values if provided (convert from Swedish field names to English)
    confirmed1Rm: (profile.oneRmBench || profile.oneRmOhp || profile.oneRmDeadlift || profile.oneRmSquat || profile.oneRmLatpull) ? {
      bench_press: profile.oneRmBench,
      overhead_press: profile.oneRmOhp,
      deadlift: profile.oneRmDeadlift,
      squat: profile.oneRmSquat,
      lat_pulldown: profile.oneRmLatpull,
    } : undefined,
    // Map goal distribution to focus distribution
    focusDistribution: (profile.goalStrength !== undefined || profile.goalVolume !== undefined || profile.goalEndurance !== undefined || profile.goalCardio !== undefined) ? {
      strength: profile.goalStrength || 0,
      hypertrophy: profile.goalVolume || 0,
      endurance: profile.goalEndurance || 0,
      cardio: profile.goalCardio || 0,
    } : undefined,
  };
}

// --------------------------------------------------------
// STEP 1: ANALYSIS & 1RM ESTIMATION
// --------------------------------------------------------

export interface AnalysisResult {
  analysis_summary: string;
  focus_distribution: {
    strength: number;
    hypertrophy: number;
    endurance: number;
    cardio: number;
  };
  estimated_1rm_kg: {
    bench_press: number;
    overhead_press: number;
    deadlift: number;
    squat: number;
    lat_pulldown: number;
  };
}

/**
 * Step 1: Analyze user profile and estimate 1RM values
 */
export async function analyzeUserProfile(profile: UserProfile): Promise<AnalysisResult> {
  const requestStartTime = Date.now();
  const config = AI_API_CONFIG.analysis;
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[AI V3] 🤖 STEP 1: USER PROFILE ANALYSIS - STARTING");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[AI V3] 📋 Input Profile:");
  console.log(JSON.stringify(profile, null, 2));
  console.log("[AI V3] ⚙️  AI Configuration:");
  console.log("  • Model:", config.model);
  console.log("  • Temperature:", config.temperature);
  console.log("  • Max Tokens:", config.max_tokens);
  console.log("  • Timeout:", config.timeout_ms, "ms");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const promptStartTime = Date.now();
  console.log("[AI V3] 📝 Building prompts...");
  const systemPrompt = buildAnalysisSystemPrompt();
  const userPrompt = buildAnalysisUserPrompt(profile);
  console.log(`[AI V3] ⏱️  Prompt building completed in ${Date.now() - promptStartTime}ms`);
  
  console.log("[AI V3] 📄 System Prompt:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(systemPrompt);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  console.log("[AI V3] 📄 User Prompt:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(userPrompt);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  try {
    // Call AI provider with model specified (fallback is handled internally)
    console.log("[AI V3] 🚀 Calling AI provider with fallback support...");
    const aiCallStartTime = Date.now();
    
    // Create timeout promise for the entire fallback chain
    // Timeout is per provider attempt, not total - fallback chain can take longer
    const totalTimeoutMs = config.timeout_ms * 2; // Allow time for fallback attempts
    console.log(`[AI V3] ⏱️  Total timeout: ${totalTimeoutMs}ms (${config.timeout_ms}ms per provider attempt)`);
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.error("[AI V3] ❌ TIMEOUT: All AI provider attempts exceeded", totalTimeoutMs, "ms");
        reject(new Error("TIMEOUT"));
      }, totalTimeoutMs);
    });
    
    const apiCallPromise = callAIProvider({
      systemPrompt,
      userPrompt,
      responseFormat: "json",
      maxTokens: config.max_tokens,
      temperature: config.temperature,
      model: config.model, // Pass model to provider
    }, true); // Enable fallback
    
    console.log("[AI V3] ⏳ Waiting for AI response (with fallback chain)...");
    const response: AIResponse = await Promise.race([apiCallPromise, timeoutPromise]);
    const aiCallDuration = Date.now() - aiCallStartTime;
    console.log(`[AI V3] ⏱️  AI call completed in ${aiCallDuration}ms`);
    
    console.log("[AI V3] 📥 Raw AI Response:");
    console.log("  • Content length:", response.content.length, "characters");
    console.log("  • Full content:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(response.content);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Clean and parse JSON
    console.log("[AI V3] 🧹 Cleaning JSON response...");
    const cleanStartTime = Date.now();
    const cleanJsonString = response.content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    console.log(`[AI V3] ⏱️  Cleaning completed in ${Date.now() - cleanStartTime}ms`);
    
    console.log("[AI V3] 📄 Cleaned JSON String:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(cleanJsonString);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    console.log("[AI V3] 🔍 Parsing JSON response...");
    const parseStartTime = Date.now();
    const result = parseAIJSONResponse(cleanJsonString) as AnalysisResult;
    console.log(`[AI V3] ⏱️  Parsing completed in ${Date.now() - parseStartTime}ms`);
    
    console.log("[AI V3] ✅ Parsed Result:");
    console.log(JSON.stringify(result, null, 2));
    
    // Validate result
    console.log("[AI V3] ✔️  Validating result structure...");
    if (!result.focus_distribution || !result.estimated_1rm_kg) {
      console.error("[AI V3] ❌ VALIDATION FAILED: Missing required fields");
      console.error("  • focus_distribution:", result.focus_distribution ? "✓" : "✗");
      console.error("  • estimated_1rm_kg:", result.estimated_1rm_kg ? "✓" : "✗");
      throw new Error("Invalid analysis result structure");
    }
    console.log("[AI V3] ✅ Structure validation passed");
    
    // Validate focus distribution sums to 100
    console.log("[AI V3] ✔️  Validating focus distribution sum...");
    const sum = 
      result.focus_distribution.strength +
      result.focus_distribution.hypertrophy +
      result.focus_distribution.endurance +
      result.focus_distribution.cardio;
    
    console.log("[AI V3] 📊 Focus Distribution Sum:", sum);
    console.log("  • Strength:", result.focus_distribution.strength);
    console.log("  • Hypertrophy:", result.focus_distribution.hypertrophy);
    console.log("  • Endurance:", result.focus_distribution.endurance);
    console.log("  • Cardio:", result.focus_distribution.cardio);
    
    if (Math.abs(sum - 100) > 1) {
      console.warn(`[AI V3] ⚠️  Focus distribution sum is ${sum}, normalizing to 100`);
      const factor = 100 / sum;
      result.focus_distribution.strength = Math.round(result.focus_distribution.strength * factor);
      result.focus_distribution.hypertrophy = Math.round(result.focus_distribution.hypertrophy * factor);
      result.focus_distribution.endurance = Math.round(result.focus_distribution.endurance * factor);
      result.focus_distribution.cardio = Math.round(result.focus_distribution.cardio * factor);
      console.log("[AI V3] 📊 Normalized Focus Distribution:");
      console.log("  • Strength:", result.focus_distribution.strength);
      console.log("  • Hypertrophy:", result.focus_distribution.hypertrophy);
      console.log("  • Endurance:", result.focus_distribution.endurance);
      console.log("  • Cardio:", result.focus_distribution.cardio);
    } else {
      console.log("[AI V3] ✅ Focus distribution sum is correct (100)");
    }
    
    console.log("[AI V3] 📊 Estimated 1RM Values (kg):");
    console.log("  • Bench Press:", result.estimated_1rm_kg.bench_press);
    console.log("  • Overhead Press:", result.estimated_1rm_kg.overhead_press);
    console.log("  • Deadlift:", result.estimated_1rm_kg.deadlift);
    console.log("  • Squat:", result.estimated_1rm_kg.squat);
    console.log("  • Lat Pulldown:", result.estimated_1rm_kg.lat_pulldown);
    
    const totalDuration = Date.now() - requestStartTime;
    console.log(`[AI V3] ⏱️  Total analysis time: ${totalDuration}ms`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[AI V3] ✅ STEP 1: ANALYSIS COMPLETED SUCCESSFULLY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    return result;
  } catch (error: any) {
    const errorDuration = Date.now() - requestStartTime;
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("[AI V3] ❌ STEP 1: ANALYSIS FAILED");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(`[AI V3] ⏱️  Error occurred after: ${errorDuration}ms`);
    console.error("[AI V3] Error type:", error?.constructor?.name || typeof error);
    console.error("[AI V3] Error message:", error.message || String(error));
    console.error("[AI V3] Error stack:", error.stack || "No stack trace");
    if (error.cause) {
      console.error("[AI V3] Error cause:", error.cause);
    }
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (error.message === "TIMEOUT") {
      throw new Error("Analysis timed out. Please try again.");
    }
    
    throw new Error(`Analysis failed: ${error.message}`);
  }
}

// --------------------------------------------------------
// STEP 2: PROGRAM CREATION
// --------------------------------------------------------

export interface ProgramExercise {
  name: string;
  sets: number;
  reps: string;
  load_guidance: string;
  calculated_weight: number | null;
  rest_seconds: number;
  note?: string;
  // New fields for master database storage
  target_muscles?: string[];
  required_equipment?: string[];
  difficulty?: string;
  movement_pattern?: string;
}

export interface ProgramDay {
  day_number: number;
  day_name: string;
  exercises: ProgramExercise[];
}

export interface ProgramResult {
  program_name: string;
  sport_specific_note?: string;
  schedule: ProgramDay[];
}

/**
 * Repair truncated JSON when MAX_TOKENS limit is reached
 * Attempts to close all open structures and return valid JSON
 */
function repairTruncatedProgramJSON(truncatedJson: string): ProgramResult {
  console.log("[AI V3] 🔧 Repairing truncated JSON...");
  
  let repaired = truncatedJson.trim();
  
  // Remove any incomplete string at the end (find last complete quote)
  const lastQuote = repaired.lastIndexOf('"');
  if (lastQuote > 0) {
    // Check if this quote is part of a complete string (has matching opening quote)
    const beforeQuote = repaired.substring(0, lastQuote);
    const quoteCount = (beforeQuote.match(/"/g) || []).length;
    if (quoteCount % 2 === 1) {
      // Odd number of quotes means we're in the middle of a string
      // Find the last complete property value
      const lastCompleteProp = repaired.lastIndexOf('",');
      if (lastCompleteProp > 0) {
        repaired = repaired.substring(0, lastCompleteProp + 1);
      }
    }
  }
  
  // Count brackets and braces to determine what needs to be closed
  let openBraces = (repaired.match(/{/g) || []).length;
  let closeBraces = (repaired.match(/}/g) || []).length;
  let openBrackets = (repaired.match(/\[/g) || []).length;
  let closeBrackets = (repaired.match(/\]/g) || []).length;
  
  // Remove trailing comma if present
  repaired = repaired.replace(/,\s*$/, '');
  
  // Close incomplete exercise object if needed
  if (repaired.trim().endsWith('"') || repaired.trim().endsWith(',')) {
    // Find the last complete exercise object by looking for closing brace
    const lastExerciseEnd = repaired.lastIndexOf('}');
    if (lastExerciseEnd > 0) {
      // Check if we're inside an exercises array
      const afterLastExercise = repaired.substring(lastExerciseEnd);
      if (!afterLastExercise.includes(']')) {
        // We need to close the exercises array and day object
        repaired = repaired.substring(0, lastExerciseEnd + 1);
        repaired += '\n        ]';
        repaired += '\n      }';
      }
    } else {
      // No complete exercise found, try to close what we have
      if (repaired.includes('"name"') && !repaired.includes('}')) {
        // Incomplete exercise, remove it
        const lastExerciseStart = repaired.lastIndexOf('{');
        if (lastExerciseStart > 0) {
          repaired = repaired.substring(0, lastExerciseStart);
          repaired = repaired.replace(/,\s*$/, '');
        }
      }
    }
  }
  
  // Close exercises array if needed
  if (openBrackets > closeBrackets) {
    const exercisesArrayStart = repaired.lastIndexOf('"exercises"');
    if (exercisesArrayStart > 0) {
      const afterExercises = repaired.substring(exercisesArrayStart);
      if (afterExercises.includes('[') && !afterExercises.includes(']')) {
        repaired += '\n        ]';
      }
    }
  }
  
  // Close day object if needed
  if (openBraces > closeBraces) {
    const dayObjectStart = repaired.lastIndexOf('"day_number"');
    if (dayObjectStart > 0) {
      const afterDay = repaired.substring(dayObjectStart);
      if (afterDay.includes('{') && !afterDay.match(/}\s*$/)) {
        repaired += '\n      }';
      }
    }
  }
  
  // Close schedule array if needed
  const scheduleStart = repaired.indexOf('"schedule"');
  if (scheduleStart > 0) {
    const afterSchedule = repaired.substring(scheduleStart);
    const scheduleBrackets = (afterSchedule.match(/\[/g) || []).length - (afterSchedule.match(/\]/g) || []).length;
    if (scheduleBrackets > 0) {
      repaired += '\n    ]';
    }
  }
  
  // Close root object
  if (!repaired.trim().endsWith('}')) {
    repaired += '\n}';
  }
  
  // Try to parse the repaired JSON
  try {
    const parsed = JSON.parse(repaired);
    const dayCount = parsed.schedule?.length || 0;
    const exerciseCount = parsed.schedule?.reduce((sum: number, day: any) => sum + (day.exercises?.length || 0), 0) || 0;
    console.log(`[AI V3] ✅ Repaired JSON: ${dayCount} days, ${exerciseCount} total exercises`);
    return parsed as ProgramResult;
  } catch (error) {
    console.error("[AI V3] ❌ Failed to parse repaired JSON:", error);
    console.error("[AI V3] Repaired JSON (first 1000 chars):", repaired.substring(0, 1000));
    throw new Error(`Failed to repair truncated JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Step 2: Create workout program based on confirmed profile data
 */
export async function createWorkoutProgram(
  profile: UserProfile,
  logistics: LogisticsContext
): Promise<ProgramResult> {
  const requestStartTime = Date.now();
  const config = AI_API_CONFIG.program;
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[AI V3] 🤖 STEP 2: PROGRAM CREATION - STARTING");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[AI V3] 📋 Input Profile:");
  console.log(JSON.stringify(profile, null, 2));
  console.log("[AI V3] 📋 Logistics:");
  console.log(JSON.stringify(logistics, null, 2));
  console.log("[AI V3] ⚙️  AI Configuration:");
  console.log("  • Model:", config.model);
  console.log("  • Temperature:", config.temperature);
  console.log("  • Max Tokens:", config.max_tokens);
  console.log("  • Timeout:", config.timeout_ms, "ms");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  const systemPrompt = buildProgramSystemPrompt();
  const userPrompt = buildProgramUserPrompt(profile, logistics);
  
  console.log("[AI V3] 📄 System Prompt Length:", systemPrompt.length, "characters");
  console.log("[AI V3] 📄 User Prompt Length:", userPrompt.length, "characters");
  console.log("[AI V3] 📄 User Prompt (first 1000 chars):", userPrompt.substring(0, 1000));
  
  try {
    // Call AI provider with model specified (fallback is handled internally)
    console.log("[AI V3] 🚀 Calling AI provider with fallback support...");
    const aiCallStartTime = Date.now();
    
    // Create timeout promise for the entire fallback chain
    // Timeout is per provider attempt, not total - fallback chain can take longer
    const totalTimeoutMs = config.timeout_ms * 2; // Allow time for fallback attempts
    console.log(`[AI V3] ⏱️  Total timeout: ${totalTimeoutMs}ms (${config.timeout_ms}ms per provider attempt)`);
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.error("[AI V3] ❌ TIMEOUT: All AI provider attempts exceeded", totalTimeoutMs, "ms");
        reject(new Error("TIMEOUT"));
      }, totalTimeoutMs);
    });
    
    const apiCallPromise = callAIProvider({
      systemPrompt,
      userPrompt,
      responseFormat: "json",
      maxTokens: config.max_tokens,
      temperature: config.temperature,
      model: config.model, // Pass model to provider
    }, true); // Enable fallback
    
    console.log("[AI V3] ⏳ Waiting for AI response (with fallback chain)...");
    let response: AIResponse;
    try {
      response = await Promise.race([apiCallPromise, timeoutPromise]);
      const aiCallDuration = Date.now() - aiCallStartTime;
      console.log(`[AI V3] ⏱️  AI call completed in ${aiCallDuration}ms`);
      console.log("[AI V3] ✅ Promise.race completed successfully (Step 2)");
    } catch (raceError: any) {
      const errorDuration = Date.now() - aiCallStartTime;
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("[AI V3] ❌ Promise.race failed (Step 2)");
      console.error(`[AI V3] ⏱️  Error occurred after: ${errorDuration}ms`);
      console.error("[AI V3] Race Error:", raceError?.message || String(raceError));
      console.error("[AI V3] Race Error Type:", raceError?.constructor?.name || typeof raceError);
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      throw raceError;
    }
    
    if (!response || !response.content) {
      console.error("[AI V3] ❌ Invalid response from AI (Step 2):", response);
      throw new Error("Invalid AI response: missing content");
    }
    
    // Check if response was truncated due to MAX_TOKENS
    if (response.finishReason === "MAX_TOKENS") {
      console.warn("[AI V3] ⚠️  WARNING: Response was truncated due to MAX_TOKENS limit");
      console.warn("[AI V3] This usually means the program is too complex. Consider reducing sessionsPerWeek or increasing max_tokens.");
    }
    
    console.log("[AI V3] 📥 Raw AI Response (Step 2):");
    console.log("  • Content length:", response.content.length, "characters");
    console.log("  • Finish reason:", response.finishReason || "unknown");
    console.log("  • First 500 chars:", response.content.substring(0, 500));
    
    // Clean and parse JSON
    const cleanJsonString = response.content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    
    console.log("[AI V3] 🧹 Cleaned JSON String (Step 2):");
    console.log("  • Length:", cleanJsonString.length, "characters");
    console.log("  • First 500 chars:", cleanJsonString.substring(0, 500));
    
    let result: ProgramResult;
    try {
      result = parseAIJSONResponse(cleanJsonString) as ProgramResult;
      console.log("[AI V3] ✅ JSON parsing successful (Step 2)");
    } catch (parseError: any) {
      // If response was truncated, try to repair the JSON
      if (response.finishReason === "MAX_TOKENS") {
        console.warn("[AI V3] ⚠️  Attempting to repair truncated JSON...");
        try {
          const repaired = repairTruncatedProgramJSON(cleanJsonString);
          result = repaired as ProgramResult;
          console.log("[AI V3] ✅ Successfully repaired truncated JSON");
        } catch (repairError: any) {
          console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          console.error("[AI V3] ❌ JSON PARSE ERROR (Step 2) - Repair failed");
          console.error("[AI V3] Parse Error:", parseError.message);
          console.error("[AI V3] Repair Error:", repairError.message);
          console.error("[AI V3] ⚠️  Response was truncated - JSON is incomplete due to token limit");
          console.error("[AI V3] 💡 Solution: Increase max_tokens in AI_API_CONFIG.program or reduce program complexity");
          console.error("[AI V3] Full Cleaned Content:");
          console.error(cleanJsonString);
          console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          throw new Error(`Failed to parse AI response as JSON: ${parseError.message} (Response truncated due to MAX_TOKENS, repair failed)`);
        }
      } else {
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.error("[AI V3] ❌ JSON PARSE ERROR (Step 2)");
        console.error("[AI V3] Parse Error:", parseError.message);
        console.error("[AI V3] Full Cleaned Content:");
        console.error(cleanJsonString);
        console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
      }
    }
    
    // Validate result
    if (!result.program_name || !result.schedule || !Array.isArray(result.schedule)) {
      console.error("[AI V3] ❌ VALIDATION FAILED (Step 2): Missing required fields");
      console.error("  • program_name:", result.program_name ? "✓" : "✗");
      console.error("  • schedule:", result.schedule ? "✓" : "✗");
      console.error("  • schedule is array:", Array.isArray(result.schedule) ? "✓" : "✗");
      console.error("[AI V3] Full result object:", JSON.stringify(result, null, 2));
      throw new Error("Invalid program result structure");
    }
    
    // Validate schedule has correct number of days
    if (result.schedule.length !== logistics.sessionsPerWeek) {
      console.warn(
        `[AI V3] Program has ${result.schedule.length} days, expected ${logistics.sessionsPerWeek}`
      );
    }
    
    const totalDuration = Date.now() - requestStartTime;
    console.log(`[AI V3] ⏱️  Total program creation time: ${totalDuration}ms`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[AI V3] ✅ STEP 2: PROGRAM CREATION COMPLETED SUCCESSFULLY");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[AI V3] Step 2: Program created successfully");
    console.log(`[AI V3] Program has ${result.schedule.length} days with warmup exercises`);
    return result;
  } catch (error: any) {
    const errorDuration = Date.now() - requestStartTime;
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("[AI V3] ❌ STEP 2: PROGRAM CREATION FAILED");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error(`[AI V3] ⏱️  Error occurred after: ${errorDuration}ms`);
    console.error("[AI V3] Error type:", error?.constructor?.name || typeof error);
    console.error("[AI V3] Error message:", error.message || String(error));
    console.error("[AI V3] Error stack:", error.stack || "No stack trace");
    if (error.cause) {
      console.error("[AI V3] Error cause:", error.cause);
    }
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    if (error.message === "TIMEOUT") {
      throw new Error("Program creation timed out. Please try again.");
    }
    
    throw new Error(`Program creation failed: ${error.message}`);
  }
}

// --------------------------------------------------------
// STEP 3: EXERCISE SWAP
// --------------------------------------------------------

export interface SwapResult {
  alternative_exercise: {
    name: string;
    sets: number;
    reps: string;
    load_guidance: string;
    rest_seconds: number;
    note?: string;
    reason_for_swap: string;
  };
}

/**
 * Step 3: Find alternative exercise to replace one in the program
 */
export async function swapExercise(context: SwapContext): Promise<SwapResult> {
  const config = AI_API_CONFIG.swap;
  
  console.log("[AI V3] Step 3: Finding exercise alternative...");
  
  const systemPrompt = buildSwapSystemPrompt();
  const userPrompt = buildSwapUserPrompt(context);
  
  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("TIMEOUT"));
      }, config.timeout_ms);
    });
    
    // Call AI provider with model specified
    const apiCallPromise = callAIProvider({
      systemPrompt,
      userPrompt,
      responseFormat: "json",
      maxTokens: config.max_tokens,
      temperature: config.temperature,
      model: config.model, // Pass model to provider
    });
    
    const response: AIResponse = await Promise.race([apiCallPromise, timeoutPromise]);
    
    // Clean and parse JSON
    const cleanJsonString = response.content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    
    const result = parseAIJSONResponse(cleanJsonString) as SwapResult;
    
    // Validate result
    if (!result.alternative_exercise || !result.alternative_exercise.name) {
      throw new Error("Invalid swap result structure");
    }
    
    console.log("[AI V3] Step 3: Exercise alternative found successfully");
    return result;
  } catch (error: any) {
    console.error("[AI V3] Step 3: Exercise swap failed:", error.message);
    
    if (error.message === "TIMEOUT") {
      throw new Error("Exercise swap timed out. Please try again.");
    }
    
    throw new Error(`Exercise swap failed: ${error.message}`);
  }
}

