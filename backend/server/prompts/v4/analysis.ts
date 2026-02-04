/**
 * V4 - Step A: Analysis prompt (EN-only)
 *
 * Purpose:
 * - Convert raw user profile/goal into a stable focus distribution that sums to 100
 * - Produce conservative volume recommendations
 * - Cache in DB for ~30 days to reduce cost
 */

export type TrainingLevel = "beginner" | "intermediate" | "advanced" | "elite";

export interface V4AnalysisInput {
  user: {
    age?: number;
    sex?: string; // keep raw; backend standardizes elsewhere if needed
    weight_kg?: number;
    height_cm?: number;
    training_level?: TrainingLevel | string;
    primary_goal: string; // e.g. "build_muscle", "lose_weight", "sport_performance"
    sport?: string | null;
    gym_name?: string | null;
    gym_location?: string | null;
  };
}

export interface V4AnalysisOutput {
  analysis_summary: string;
  focus_distribution: {
    strength: number;
    hypertrophy: number;
    endurance: number;
    cardio: number;
  };
  recommendations: {
    sets_per_session_min: number;
    sets_per_session_max: number;
    weekly_volume_sets_min: number;
    weekly_volume_sets_max: number;
  };
}

export function buildAnalysisSystemPromptV4(): string {
  return [
    "Role: You are a Sports Physiologist and Strength & Conditioning coach for a fitness app.",
    "",
    "Task: Analyze user profile and return a conservative training analysis in STRICT JSON.",
    "",
    "Hard rules:",
    "- Output MUST be valid JSON only (no markdown, no explanations).",
    "- Language: English only.",
    "- focus_distribution values must be integers and sum to exactly 100.",
    "- Be conservative and practical. Avoid extreme training volumes.",
    "- If sport is provided, bias focus toward sport demands (but still sum to 100).",
  ].join("\n");
}

export function buildAnalysisUserPromptV4(input: V4AnalysisInput): string {
  // Keep prompt compact. All heavy logic should live in DB/candidate pools and deterministic fitting.
  return JSON.stringify(
    {
      user: {
        age: input.user.age ?? null,
        sex: input.user.sex ?? null,
        weight_kg: input.user.weight_kg ?? null,
        height_cm: input.user.height_cm ?? null,
        training_level: input.user.training_level ?? null,
        primary_goal: input.user.primary_goal,
        sport: input.user.sport ?? null,
        gym_name: input.user.gym_name ?? null,
        gym_location: input.user.gym_location ?? null,
      },
      output_schema: {
        analysis_summary: "string",
        focus_distribution: { strength: 0, hypertrophy: 0, endurance: 0, cardio: 0 },
        recommendations: {
          sets_per_session_min: 0,
          sets_per_session_max: 0,
          weekly_volume_sets_min: 0,
          weekly_volume_sets_max: 0,
        },
      },
    },
    null,
    2
  );
}
