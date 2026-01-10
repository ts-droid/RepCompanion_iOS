/**
 * Exercise Replacement Service
 * Handles AI-powered replacement of unmatched exercises
 */

import { callAIProvider, parseAIJSONResponse } from "./ai-providers";
import { db } from "./db";
import { exercises } from "@shared/schema";
import { sql } from "drizzle-orm";

export interface ReplacementRequest {
  originalExercise: string;
  targetMuscles: string[];
  availableEquipment: string[];
  sets: number;
  reps: string;
  userLevel?: string; // Beginner, Intermediate, Advanced
}

export interface ReplacementResult {
  name: string; // Matched exercise from catalog
  reps: string;
  sets: number;
  reason: string; // Why this replacement was chosen
}

/**
 * Request AI to find a replacement exercise from the catalog
 * Uses user's available equipment and targets same muscle groups
 */
export async function requestExerciseReplacement(
  request: ReplacementRequest
): Promise<ReplacementResult | null> {
  const requestStartTime = Date.now();
  console.log(`[EXERCISE REPLACER] 🔄 Finding replacement for "${request.originalExercise}"`);
  console.log(`[EXERCISE REPLACER] Target muscles:`, request.targetMuscles);
  console.log(`[EXERCISE REPLACER] Available equipment:`, request.availableEquipment);
  
  try {
    // 1. Get all exercises from catalog that match user's equipment
    const availableExercises = await getExercisesByEquipment(request.availableEquipment);
    console.log(`[EXERCISE REPLACER] Found ${availableExercises.length} exercises with user's equipment`);
    
    if (availableExercises.length === 0) {
      console.error(`[EXERCISE REPLACER] ❌ No exercises available with user's equipment`);
      return null;
    }
    
    // 2. Filter by muscle group if specified
    let muscleMatches = availableExercises;
    if (request.targetMuscles && request.targetMuscles.length > 0) {
      muscleMatches = availableExercises.filter(ex => {
        const allMuscles = [...(ex.primaryMuscles || []), ...(ex.secondaryMuscles || [])];
        return request.targetMuscles.some(targetMuscle => 
          allMuscles.some(exMuscle => 
            exMuscle.toLowerCase().includes(targetMuscle.toLowerCase()) ||
            targetMuscle.toLowerCase().includes(exMuscle.toLowerCase())
          )
        );
      });
      
      console.log(`[EXERCISE REPLACER] Filtered to ${muscleMatches.length} exercises matching muscle groups`);
      
      // Fallback: if no muscle matches, use all available exercises
      if (muscleMatches.length === 0) {
        console.warn(`[EXERCISE REPLACER] ⚠️ No exercises match target muscles, using all available`);
        muscleMatches = availableExercises;
      }
    }
    
    // 3. Build AI prompt
    const systemPrompt = buildReplacementSystemPrompt();
    const userPrompt = buildReplacementUserPrompt(request, muscleMatches);
    
    console.log(`[EXERCISE REPLACER] 🤖 Calling AI for replacement suggestion...`);
    const aiCallStartTime = Date.now();
    
    // 4. Call AI with timeout
    const timeoutMs = 30000; // 30 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
    });
    
    const apiCallPromise = callAIProvider({
      systemPrompt,
      userPrompt,
      responseFormat: "json",
      maxTokens: 2000, // Increased from 1000 - Gemini uses many tokens for thinking
      temperature: 0.3, // Low temperature for consistent choices
      model: "gemini-2.5-flash",
    });
    
    const response = await Promise.race([apiCallPromise, timeoutPromise]);
    const aiCallDuration = Date.now() - aiCallStartTime;
    console.log(`[EXERCISE REPLACER] ⏱️ AI call completed in ${aiCallDuration}ms`);
    
    // 5. Parse response
    const cleanedJson = response.content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    
    const result = parseAIJSONResponse(cleanedJson) as ReplacementResult;
    
    // 6. Validate result
    if (!result.name || !result.reason) {
      console.error(`[EXERCISE REPLACER] ❌ Invalid AI response:`, result);
      return null;
    }
    
    // 7. Verify the suggested exercise exists in our filtered list
    const exerciseExists = muscleMatches.some(ex => 
      ex.nameEn?.toLowerCase() === result.name.toLowerCase()
    );
    
    if (!exerciseExists) {
      console.error(`[EXERCISE REPLACER] ❌ AI suggested exercise not in available list: "${result.name}"`);
      return null;
    }
    
    const totalDuration = Date.now() - requestStartTime;
    console.log(`[EXERCISE REPLACER] ✅ Found replacement in ${totalDuration}ms:`);
    console.log(`[EXERCISE REPLACER]   Original: "${request.originalExercise}"`);
    console.log(`[EXERCISE REPLACER]   Replacement: "${result.name}"`);
    console.log(`[EXERCISE REPLACER]   Reason: ${result.reason}`);
    
    return result;
  } catch (error: any) {
    const errorDuration = Date.now() - requestStartTime;
    console.error(`[EXERCISE REPLACER] ❌ Failed to find replacement after ${errorDuration}ms:`, error.message);
    return null;
  }
}

/**
 * Get exercises that can be performed with user's equipment
 */
async function getExercisesByEquipment(equipmentList: string[]): Promise<any[]> {
  // Normalize equipment names
  const normalizedEquipment = equipmentList.map(eq => 
    eq.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  );
  
  // Get all exercises with English names - SELECT ONLY NEEDED COLUMNS
  const allExercises = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      nameEn: exercises.nameEn,
      primaryMuscles: exercises.primaryMuscles,
      secondaryMuscles: exercises.secondaryMuscles,
      requiredEquipment: exercises.requiredEquipment,
      category: exercises.category,
      difficulty: exercises.difficulty,
    })
    .from(exercises)
    .where(sql`${exercises.nameEn} IS NOT NULL`);
  
  // Filter exercises where ALL required equipment is available
  const matchingExercises = allExercises.filter(exercise => {
    // Bodyweight exercises (no equipment required)
    if (!exercise.requiredEquipment || exercise.requiredEquipment.length === 0) {
      return true;
    }
    
    // Check if all required equipment is available
    const required = exercise.requiredEquipment.map(eq => 
      eq.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
    );
    
    return required.every(req => 
      normalizedEquipment.some(avail => 
        avail.includes(req) || req.includes(avail)
      )
    );
  });
  
  return matchingExercises;
}

/**
 * Build system prompt for replacement AI
 */
function buildReplacementSystemPrompt(): string {
  return `You are a professional fitness coach and exercise expert. Your task is to find the BEST replacement exercise from a provided list.

CRITICAL RULES:

1. Replacement MUST be from the "Available Exercises" list - use EXACT names
2. Target the same muscle groups as the original exercise
3. Match the training stimulus (strength, hypertrophy, endurance)
4. Prefer exercises with similar movement patterns
5. Consider the user's training level

OUTPUT FORMAT (JSON):

{
  "name": "Exact exercise name from Available Exercises list",
  "sets": number,
  "reps": "rep range (e.g., 8-10)",
  "reason": "Brief explanation of why this is a good replacement"
}`;
}

/**
 * Build user prompt for replacement AI
 */
function buildReplacementUserPrompt(
  request: ReplacementRequest,
  availableExercises: any[]
): string {
  const exerciseNames = availableExercises
    .map(ex => ex.nameEn)
    .filter(Boolean)
    .slice(0, 100); // Limit to 100 exercises to keep prompt manageable
  
  return `FIND REPLACEMENT FOR:

Original Exercise: "${request.originalExercise}"
Target Muscles: ${request.targetMuscles.join(", ") || "Not specified"}
Sets/Reps: ${request.sets} sets × ${request.reps} reps
User Level: ${request.userLevel || "Intermediate"}

AVAILABLE EXERCISES (choose ONE from this list):

${exerciseNames.join("\n")}

Choose the BEST replacement that:
1. Targets the same muscles
2. Matches the rep/set scheme
3. Is appropriate for the user's level
4. Uses available equipment

Return ONLY the JSON response with the exact exercise name from the list above.`;
}
