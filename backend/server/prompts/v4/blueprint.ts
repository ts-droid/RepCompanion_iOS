/**
 * V4 - Step B: Program Blueprint prompt (EN-only, IDs-only).
 *
 * Key constraints:
 * - The model MUST choose exercises only from the provided candidate pool buckets.
 * - The model MUST return exercise_id only (no localized names).
 * - Deterministic time fitting will be applied in code (server/utils/timeFitting.ts).
 */

export type LoadType = "percentage_1rm" | "rpe" | "bodyweight" | "fixed";
export type BlockType = "warmup" | "main" | "accessory" | "cardio" | "cooldown" | "core";

export interface V4TimeModel {
  work_seconds_per_10_reps: number;
  rest_between_sets_seconds: number;
  rest_between_exercises_seconds: number;
  warmup_minutes_default: number;
  cooldown_minutes_default: number;
}

export interface V4CandidatePools {
  // Bucketed lists to keep token usage low and selection constrained.
  // Keep each bucket small (e.g. 8-25 items).
  [bucket: string]: string[];
}

export interface V4BlueprintInput {
  schedule: {
    sessions_per_week: number;
    target_minutes: number;
    allowed_duration_minutes: { min: number; max: number };
    weekdays: string[];
  };
  focus_distribution: {
    strength: number;
    hypertrophy: number;
    endurance: number;
    cardio: number;
  };
  sport?: string | null;
  time_model: V4TimeModel;
  candidate_pools: V4CandidatePools;
  // Optional: pool hash/version for debugging.
  candidate_pool_hash?: string;
}

export function buildBlueprintSystemPromptV4(): string {
  return [
    "Role: You are an elite Strength & Conditioning coach.",
    "",
    "You must output STRICT JSON only (no markdown, no commentary).",
    "",
    "Hard rules:",
    "- You may ONLY use exercise_id values present in candidate_pools buckets.",
    "- RETURN exercise_id for matching, AND 'exercise_name' in SWEDISH for presentation.",
    "- Use ENGLISH KEYS for all metadata: 'category', 'primary_muscles', 'secondary_muscles', 'required_equipment', 'load_type'.",
    "- Use SWEDISH for all display text: 'program_name', session 'name', exercise 'notes', and 'warmup_description'.",
    "- Provide priority per exercise: 1=protect, 2=adjustable, 3=remove first.",
    "- Keep sessions balanced across the week (~48h recovery for the same primary muscle groups where possible).",
    "- Respect the time_model. Try to land within allowed_duration_minutes, but the server will enforce final fitting.",
    "- VOLUME GUIDANCE: Aim for 5-8 exercises per 60-minute session. Use more exercises rather than more sets to fill time.",
    "- SETS GUIDANCE: Standard strength/hypertrophy exercises should typically have 2-4 sets. Do NOT exceed 6 sets for any exercise.",
    "- SESSION NAMING: Create descriptive names.",
    "- STRICTION: Do NOT use generic names.",
  ].join("\n");
}

export function buildBlueprintSystemPromptV4_5(): string {
  return [
    "Role: You are an elite Strength & Conditioning coach designing a PERIODIZED MESOCYCLE.",
    "",
    "You must output STRICT JSON only (no markdown, no commentary).",
    "",
    "OBJECTIVE:",
    "Create a ROBUST training cycle (Mesocycle) that spans 4 weeks. NOT just a single week.",
    "Specifically for users with LOW frequency (e.g. 2-3 sessions/week), you MUST provide a variety of sessions (8-12 unique sessions) that rotationally cover the whole body over 4 weeks.",
    "",
    "Hard rules:",
    "- You may ONLY use exercise_id values present in candidate_pools buckets.",
    "- RETURN exercise_id for matching, AND 'exercise_name' in SWEDISH for presentation.",
    "- Use ENGLISH KEYS for all metadata: 'category', 'primary_muscles', 'secondary_muscles', 'required_equipment', 'load_type'.",
    "- Use SWEDISH for all display text: 'program_name', session 'name', exercise 'notes', and 'warmup_description'.",
    "- Provide priority per exercise: 1=protect, 2=adjustable, 3=remove first.",
    "",
    "CYCLE STRUCTURE:",
    "- If sessions_per_week is LOW (1-3): Create a pool of 8-12 unique sessions that rotate. For example, Week 1 (Session 1, 2), Week 2 (Session 3, 4), Week 3 (Session 5, 6), Week 4 (Session 7, 8).",
    "- Do NOT just repeat the same 2-3 sessions. The user needs variety and progressive overload across the 4-week cycle.",
    "- If sessions_per_week is HIGH (4+): You can stick to a standard Main Week cycle.",
    "- ASSIGN DAYS: Use the provided `weekdays` to assign realistic days. Since this is a multi-week cycle, you can REPEAT days across weeks (e.g. Session 1 is Monday of Week 1, Session 3 is Monday of Week 2).",
    "",
    "VOLUME & SETS:",
    "- Aim for 5-8 exercises per 60-minute session.",
    "- Sets: 2-4 per exercise. Max 6.",
    "",
    "NAMING:",
    "- Create descriptive names in Swedish.",
    "- Do NOT include 'Pass A', 'Pass 1', 'Session A' or similar prefixes in session names. Focus on the muscle group or goal (e.g., 'Underkropp - Styrka' instead of 'Pass A').",
  ].join("\n");
}

export function buildBlueprintUserPromptV4(input: V4BlueprintInput): string {
  return JSON.stringify(
    {
      schedule: input.schedule,
      focus_distribution: input.focus_distribution,
      sport: input.sport ?? null,
      time_model: input.time_model,
      candidate_pool_hash: input.candidate_pool_hash ?? null,
      candidate_pools: input.candidate_pools,
      output_schema: {
        program_name: "string",
        duration_weeks: 2,
        sessions: [
          {
            session_index: 1,
            week_number: 1,
            weekday: "Mon",
            name: "string",
            blocks: [
              {
                type: "warmup|main|accessory|cardio|cooldown|core",
                exercises: [
                  {
                    exercise_id: "string",
                    sets: 3,
                    reps: "8-12|30-45s|6 min",
                    rest_seconds: 90,
                    load_type: "percentage_1rm|rpe|bodyweight|fixed",
                    load_value: 8,
                    priority: 2,
                    notes: null,
                    category: "string",
                    required_equipment: ["string"],
                    primary_muscles: ["string"],
                    secondary_muscles: ["string"],
                    difficulty: "Nybörjare|Medel|Avancerad"
                  }
                ]
              }
            ]
          }
        ]
      },
      constraints: {
        ids_only: true,
        must_use_candidate_pool_only: true
      }
    },
    null,
    2
  );
}

export function buildBlueprintUserPromptV4_5(input: V4BlueprintInput): string {
  // Enforce 4-week duration for low frequency
  const targetSessions = (input.schedule.sessions_per_week || 3) * 4;
  
  return JSON.stringify(
    {
      objectif: "Create a 4-WEEK MESOCYCLE with unique rotating sessions.",
      cycle_duration: "4 Weeks",
      total_sessions_required: targetSessions, 
      schedule: input.schedule,
      focus_distribution: input.focus_distribution,
      sport: input.sport ?? null,
      time_model: input.time_model,
      candidate_pool_hash: input.candidate_pool_hash ?? null,
      candidate_pools: input.candidate_pools,
      output_schema: {
        program_name: "string",
        duration_weeks: 4,
        sessions: [ // Provide ample examples to encourage multiple sessions
          {
            session_index: 1,
            week_number: 1,
            weekday: "Mon (Week 1)",
            name: "Underkropp - Knädominant",
            blocks: []
          },
          {
            session_index: 2,
            week_number: 1,
            weekday: "Ons (Week 1)",
            name: "Överkropp - Press",
            blocks: []
          },
          {
             session_index: 3,
             week_number: 1,
             weekday: "Fre (Week 1)",
             name: "Överkropp - Drag",
             blocks: []
          },
          {
            session_index: 4,
            week_number: 2,
            weekday: "Mån (Week 2)",
            name: "Underkropp - Höftdominant",
            blocks: []
          },
           // ... continue up to session 12
        ]
      },
      constraints: {
        ids_only: true,
        must_use_candidate_pool_only: true,
        generate_full_cycle: true
      }
    },
    null,
    2
  );
}
