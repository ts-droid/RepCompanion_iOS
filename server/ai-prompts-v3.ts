/**
 * AI Prompts V3 - Structured API Architecture
 * Based on "Best Practice" Split:
 * 1. Analysis & 1RM Estimation (Low Temp)
 * 2. Program Creation (Medium Temp)
 * 3. Exercise Swap (Ad-hoc)
 */

// --------------------------------------------------------
// INTERFACES
// --------------------------------------------------------

export interface UserProfile {
  age?: number;
  sex?: string; // 'Man', 'Woman'
  bodyWeight?: number;
  height?: number;
  trainingLevel?: string; // 'Beginner', 'Intermediate', 'Advanced', 'Elite'
  primaryGoal?: string; // 'Sport', 'Build Muscle', 'Strength', etc.
  specificSport?: string; // e.g., 'Ice Hockey'
  
  // Confirmed 1RMs (Used in Step 2)
  confirmed1Rm?: {
    bench_press?: number;
    overhead_press?: number;
    deadlift?: number;
    squat?: number;
    lat_pulldown?: number;
  };
  // Focus Distribution (Result from Step 1, input for Step 2)
  focusDistribution?: {
    strength: number;
    hypertrophy: number;
    endurance: number;
    cardio: number;
  };
}

export interface LogisticsContext {
  sessionsPerWeek: number;
  sessionDurationMinutes: number;
  equipmentList: string;
  // Note: filteredExerciseNames removed - We now validate exercises AFTER AI generation
  // instead of pre-filtering. This allows AI more flexibility while we ensure
  // equipment compatibility through post-validation.
}

export interface SwapContext {
  userGoal: string;
  userLevel: string;
  originalExercise: string;
  originalIntent: string; // e.g. "Explosive Power"
  reasonForSwap: string; // e.g. "No Kettlebell available"
  availableEquipment: string;
  allowedExercises?: string[]; // List of exercises that match available equipment
}

// --------------------------------------------------------
// STEP 1: ANALYSIS & PROFILING
// --------------------------------------------------------

export function buildAnalysisSystemPrompt(): string {
  return `You are an expert Sports Physiologist and Data Analyst. Your task is to analyze a user profile and generate a strategic workout distribution and estimated strength metrics.

CRITICAL OUTPUT RULES:

1. Output strictly valid JSON.

2. Do NOT use markdown code blocks. Return the raw JSON string only.

3. No conversational text.

4. All text values inside the JSON must be in English.

LOGIC GUIDELINES:

1. Focus Distribution: Allocate 100% total across: "Strength", "Hypertrophy", "Endurance", "Cardio".

   - If Goal is "Sport", adapt distribution to the specific sport's physiology (e.g., Hockey = Power/Intervals).

   - If Goal is "Rehabilitation", prioritize Stability/Endurance.

2. Estimated 1RM: Estimate 1 Rep Max (kg) for: Bench Press, Overhead Press, Deadlift, Squat, Lat Pulldown.

   - Base this on Gender, Age, Weight, and Training Level.

   - For "Beginner", be very conservative.

   - For "Elite", use competitive standards relative to body weight.`;
}

export function buildAnalysisUserPrompt(profile: UserProfile): string {
  return `ANALYZE USER:

- Primary Goal: ${profile.primaryGoal} (Specific Sport: ${profile.specificSport || 'None'})

- Level: ${profile.trainingLevel}

- Age: ${profile.age}

- Gender: ${profile.sex}

- Weight: ${profile.bodyWeight} kg

- Height: ${profile.height} cm

OUTPUT JSON STRUCTURE:

{
  "analysis_summary": "Short comment about the physiological strategy (max 1 sentence).",
  "focus_distribution": {
    "strength": 0,
    "hypertrophy": 0,
    "endurance": 0,
    "cardio": 0
  },
  "estimated_1rm_kg": {
    "bench_press": 0,
    "overhead_press": 0,
    "deadlift": 0,
    "squat": 0,
    "lat_pulldown": 0
  }
}`;
}

// --------------------------------------------------------
// STEP 2: CREATE PROGRAM
// --------------------------------------------------------

export function buildProgramSystemPrompt(): string {
  return `You are an Elite Strength & Conditioning Coach. Create a detailed workout program based on user data and logistics.

CRITICAL OUTPUT RULES:

1. Output strictly valid JSON.

2. Do NOT use markdown code blocks. Return the raw JSON string only.

3. All text values inside the JSON must be in English.

LOGIC GUIDELINES:

1. Exercise Selection - CRITICAL RULE:
   - If "Allowed Exercises" list is provided, you MUST ONLY use exercises from that exact list
   - You are FORBIDDEN from suggesting any exercise NOT in the "Allowed Exercises" list
   - Each exercise name in your response MUST match exactly (case-insensitive) one exercise from the "Allowed Exercises" list
   - If you cannot create a complete program using only exercises from the list, you must still use ONLY exercises from the list
   - Suggesting exercises not in the list will cause the program generation to fail and require manual correction
   - The "Allowed Exercises" list has been pre-filtered to match the user's available equipment - trust this list completely

2. Sport Specificity: If a sport is specified, prioritize exercises that improve performance for that sport (but still ONLY from the Allowed Exercises list).

3. Volume & Intensity: Use the "Focus Distribution" and "Level" to determine sets, reps, and rest.

4. Load Calculation:

   - Use the provided "Confirmed 1RM" values to calculate working weights (e.g., 75% of 1RM).

   - If an exercise is not based on the main lifts, use RPE (1-10) or specific notes.

5. Structure: Create a routine that fits the "Frequency" (Days/Week).

   - 1-3 days: Full Body.

   - 4 days: Upper/Lower split.

   - 5-6 days: PPL or Body Part split.

6. CRITICAL - Session Requirements (MANDATORY):
   - You MUST create EXACTLY the number of sessions specified in "Frequency" (Days/Week)
   - If user requests 5 sessions per week, create EXACTLY 5 sessions with exercises (no more, no less)
   - If user requests 4 sessions per week, create EXACTLY 4 sessions with exercises (no more, no less)
   - DO NOT create "Rest" days, "Rest or Active Recovery" sessions, or any sessions with 0 exercises
   - Session volume is calculated by TOTAL SETS: Each set takes ~2 minutes (30 sec work + 90 sec rest)
   - A 30 min session = ~15 sets, 45 min = ~22 sets, 60 min = ~30 sets, 90 min = ~45 sets
   - Plan 3-4 sets per exercise, so 60 min = ~8-9 exercises with 30 total sets
   - All sessions must be active training sessions with actual exercises from the "Allowed Exercises" list
   - The "schedule" array length MUST equal the "Frequency" number exactly`;
}

export function buildProgramUserPrompt(profile: UserProfile, logistics: LogisticsContext): string {
  const confirmed1RmStr = JSON.stringify(profile.confirmed1Rm || {});
  const focusDistStr = JSON.stringify(profile.focusDistribution || {});
  
  // Calculate recommended total sets based on session duration
  // Each set takes ~2 minutes (30 sec work + 90 sec rest on average)
  // 30min = 15 sets, 45min = ~22 sets, 60min = 30 sets, 75min = ~37 sets, 90min = 45 sets
  const totalSetsPerSession = Math.round(logistics.sessionDurationMinutes / 2);
  
  // Calculate exercise count based on average 3.5 sets per exercise
  // This allows mix of 3-set and 4-set exercises
  const avgSetsPerExercise = 3.5;
  const exercisesPerSession = Math.max(5, Math.round(totalSetsPerSession / avgSetsPerExercise));
  const minExercises = Math.max(5, exercisesPerSession - 1);
  const maxExercises = exercisesPerSession + 1;
  
  // Equipment constraint message - exercises will be validated after AI response
  const equipmentConstraint = `

⚠️ CRITICAL EQUIPMENT CONSTRAINT:
You MUST ONLY suggest exercises that can be performed with the equipment listed above.
- If "Barbell" is NOT in the equipment list, do NOT suggest Barbell exercises
- If "Cable Machine" is NOT listed, do NOT suggest Cable exercises  
- If "Dumbbells" is NOT listed, do NOT suggest Dumbbell exercises
- Bodyweight exercises are ALWAYS acceptable
- Each exercise you suggest MUST include "required_equipment" array listing what equipment it needs

After program generation, every exercise will be validated against the user's equipment.
Exercises requiring unavailable equipment will be REJECTED and replaced.`;
  
  return `CREATE PROGRAM FOR:

PROFILE (Valid & Confirmed):

- Goal: ${profile.primaryGoal} (Sport: ${profile.specificSport || 'None'})

- Level: ${profile.trainingLevel}

- Confirmed 1RM (kg): ${confirmed1RmStr}

- Focus Distribution: ${focusDistStr}

LOGISTICS:

- Frequency: ${logistics.sessionsPerWeek} days/week (CRITICAL: You MUST create EXACTLY ${logistics.sessionsPerWeek} sessions in the schedule array)

- Duration: ${logistics.sessionDurationMinutes} min/session
  • TARGET: ${totalSetsPerSession} total sets per session (based on ~2 min per set including rest)
  • This means ${minExercises}-${maxExercises} exercises with 3-4 sets each
  • Plan exercises so total sets add up to approximately ${totalSetsPerSession}

- Available Equipment: ${logistics.equipmentList}${equipmentConstraint}

OUTPUT JSON STRUCTURE:

{
  "program_name": "Name of the program",
  "sport_specific_note": "How this helps the specific sport (optional)",
  "schedule": [
    {
      "day_number": 1,
      "day_name": "e.g., Upper Body Strength",
      "exercises": [
        {
          "name": "Exercise Name (MUST be from Allowed Exercises list)",
          "sets": 4,
          "reps": "8-10",
          "load_guidance": "70% of 1RM",
          "calculated_weight": 52.5,
          "rest_seconds": 90,
          "note": "Technique or intent note",
          "target_muscles": ["Chest", "Triceps"],
          "required_equipment": ["Barbell", "Bench"],
          "difficulty": "Beginner|Intermediate|Advanced",
          "movement_pattern": "Push|Pull|Squat|Hinge|Carry|Isolation|Cardio"
        }
      ]
    }
  ]
}

WEIGHT CALCULATION RULES:
- For main lifts (Bench Press, Squat, Deadlift, Overhead Press, Lat Pulldown), calculate "calculated_weight" using the Confirmed 1RM values and load_guidance percentage
- Example: If Bench Press 1RM = 75kg and load_guidance = "70% of 1RM", then calculated_weight = 52.5
- For other exercises, estimate a reasonable weight based on user's strength level or set calculated_weight to null
- NEVER leave calculated_weight as 0 for main lifts - always calculate it

CRITICAL REQUIREMENTS (VALIDATION WILL REJECT IF NOT MET):
- The "schedule" array MUST contain EXACTLY ${logistics.sessionsPerWeek} items (not ${logistics.sessionsPerWeek - 1}, not ${logistics.sessionsPerWeek + 1}, EXACTLY ${logistics.sessionsPerWeek})
- Each session MUST have ${minExercises}-${maxExercises} exercises with 3-4 sets each
- TARGET total sets per session: ${totalSetsPerSession} sets (sum of all exercise sets should be close to this)
- DO NOT include any sessions with fewer than ${minExercises} exercises - they will be rejected
- All exercise names MUST be from the "Allowed Exercises" list provided above - using exercises NOT in the list will cause FAILURE
- Each exercise MUST include "target_muscles" and "required_equipment" arrays
- Each main lift exercise MUST have a calculated_weight value based on the Confirmed 1RM
- Before finalizing, verify: ${logistics.sessionsPerWeek} sessions, ${minExercises}-${maxExercises} exercises each, ~${totalSetsPerSession} total sets each`;
}


// --------------------------------------------------------
// STEP 3: SWAP EXERCISE
// --------------------------------------------------------

export function buildSwapSystemPrompt(): string {
  return `You are an expert Fitness Coach specializing in scaling exercises and finding substitutions. Your task is to provide ONE alternative exercise to replace a specific movement in a user's program.

CRITICAL OUTPUT RULES:

1. Output strictly valid JSON.

2. Do NOT use markdown code blocks. Return the raw JSON string only.

3. All text values inside the JSON must be in English.

LOGIC GUIDELINES:

1. Biomechanics: The alternative exercise must target the same muscle groups and movement pattern (e.g., Push, Pull, Hinge, Squat) as the original.

2. Constraint Adherence: STRICTLY follow the "Limitation/Reason" provided by the user.

   - Example: If user says "No Barbell", do not suggest a barbell exercise.
   
   - If "Allowed Exercises" list is provided, you MUST ONLY suggest exercises from that list
   - The exercise name you suggest MUST match exactly (case-insensitive) one exercise from the "Allowed Exercises" list
   - If no "Allowed Exercises" list is provided, ensure the exercise uses only equipment from the "Available Equipment" list

3. Level Appropriate: Keep the difficulty consistent with the user's level.`;
}

export function buildSwapUserPrompt(ctx: SwapContext): string {
  return `FIND ALTERNATIVE FOR:

CONTEXT:

- User Goal: ${ctx.userGoal}

- User Level: ${ctx.userLevel}

- Original Exercise: ${ctx.originalExercise}

- Original Intent: ${ctx.originalIntent}

LIMITATION / REASON:

- ${ctx.reasonForSwap}

AVAILABLE EQUIPMENT:

- ${ctx.availableEquipment}${ctx.allowedExercises && ctx.allowedExercises.length > 0
    ? `\n\n⚠️ CRITICAL: You MUST ONLY suggest exercises from this list:\nAllowed Exercises: ${ctx.allowedExercises.join(', ')}\n\nThe exercise name you suggest MUST match exactly (case-insensitive) one exercise from the list above.`
    : ''}

OUTPUT JSON STRUCTURE:

{
  "alternative_exercise": {
    "name": "Name of new exercise",
    "sets": 0,
    "reps": "e.g., 10-12",
    "load_guidance": "e.g., RPE 7",
    "rest_seconds": 0,
    "note": "Technique note for this specific variation",
    "reason_for_swap": "Short explanation of why this is a good alternative."
  }
}`;
}

// --------------------------------------------------------
// CONFIGURATION
// --------------------------------------------------------

export const AI_API_CONFIG = {
  analysis: {
    model: "gemini-2.5-flash", // Updated to Gemini 2.5 (1.5 models are retired)
    temperature: 0.2,
    max_tokens: 2000, // Increased from 1000 to prevent MAX_TOKENS truncation
    timeout_ms: 120000 // 2 minutes (increased from 20s to allow for fallback chain)
  },
  program: {
    model: "gemini-2.5-flash", // Updated to Gemini 2.5 (1.5 models are retired)
    temperature: 0.5,
    max_tokens: 16000, // Increased from 8000 to handle full program JSON (5 days with detailed exercises)
    timeout_ms: 180000 // 3 minutes (increased from 45s for complex program generation)
  },
  swap: {
    model: "gemini-2.5-flash", // Updated to Gemini 2.5 (1.5 models are retired)
    temperature: 0.4,
    max_tokens: 800,
    timeout_ms: 60000 // 1 minute (increased from 15s)
  }
} as const;

