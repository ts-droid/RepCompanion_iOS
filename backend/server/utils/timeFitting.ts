/**
 * Deterministic time fitting for V4 workout programs.
 *
 * Backend language: English. UI can localize separately.
 *
 * Defaults (user-adjustable via DB `user_time_model`):
 * - Work time: 30 seconds per 10 reps (=> 3s/rep)
 * - Rest BETWEEN sets: 90 seconds (not after last set)
 * - Rest/transition BETWEEN exercises: 120 seconds (not after last exercise)
 *
 * Key idea:
 * - LLM generates a blueprint (exercise_id, sets, reps, priority, rest_seconds optional).
 * - Server enforces time constraints deterministically without calling the LLM again.
 */

export type LoadType = "percentage_1rm" | "rpe" | "bodyweight" | "fixed";
export type BlockType = "warmup" | "main" | "accessory" | "cardio" | "cooldown";

export interface TimeModelConfig {
  workSecondsPer10Reps: number; // default 30
  restBetweenSetsSeconds: number; // default 90
  restBetweenExercisesSeconds: number; // default 120
  warmupMinutesDefault?: number; // optional fallback if warmup block omitted
  cooldownMinutesDefault?: number; // optional fallback if cooldown block omitted
}

export interface ExerciseCaps {
  minSets?: number;
  maxSets?: number;
}

export interface ExercisePrescription {
  exercise_id: string;
  sets: number;
  reps: string; // e.g. "8-12", "10", "30-45s", "6 min"
  rest_seconds?: number | null; // optional per-exercise override for BETWEEN-SETS rest
  load_type: LoadType;
  load_value: number;
  priority: 1 | 2 | 3; // 1 = protect, 2 = adjustable, 3 = adjust/remove first
  notes?: string | null;
}

export interface Block {
  type: BlockType;
  exercises: ExercisePrescription[];
}

export interface SessionBlueprint {
  session_index: number;
  weekday: string;
  name?: string;
  blocks: Block[];
}

export interface FitAction {
  action: "reduce_sets" | "add_sets" | "remove_exercise";
  exercise_id: string;
  block_type: BlockType;
  from_sets?: number;
  to_sets?: number;
  delta_sets?: number;
}

export interface FitReport {
  before_minutes: number;
  after_minutes: number;
  target_minutes: number;
  allowed_min: number;
  allowed_max: number;
  actions: FitAction[];
  status: "ok" | "needs_review";
  note?: string;
}

export interface FitResult {
  session: SessionBlueprint;
  report: FitReport;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function minutesFromSeconds(sec: number): number {
  return sec / 60;
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Estimate WORK seconds for ONE set from reps string.
 * - Range "8-12" => uses upper bound (12) for conservative timing.
 * - "30-45s" or "45s" => seconds
 * - "6 min" => minutes
 * - fallback => assumes 10 reps
 */
export function estimateWorkSecondsPerSet(reps: string, cfg: TimeModelConfig): number {
  const r = (reps || "").trim().toLowerCase();
  if (!r) return cfg.workSecondsPer10Reps;

  const minMatch = r.match(/(\d+(?:\.\d+)?)\s*min/);
  if (minMatch) {
    const mins = Number(minMatch[1]);
    if (Number.isFinite(mins)) return mins * 60;
  }

  const secMatch = r.match(/(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds)\b/);
  if (secMatch) {
    const secs = Number(secMatch[1]);
    if (Number.isFinite(secs)) return secs;
  }

  const rangeMatch = r.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    const high = Number(rangeMatch[2]);
    const repsNum = Number.isFinite(high) ? high : 10;
    return (cfg.workSecondsPer10Reps / 10) * repsNum;
  }

  const numMatch = r.match(/(\d+)/);
  if (numMatch) {
    const repsNum = Number(numMatch[1]);
    return (cfg.workSecondsPer10Reps / 10) * (Number.isFinite(repsNum) ? repsNum : 10);
  }

  return cfg.workSecondsPer10Reps;
}

/**
 * Estimate total seconds for an exercise across all sets (excluding between-exercise transitions).
 * Rest between sets uses ex.rest_seconds if present, else cfg.restBetweenSetsSeconds.
 */
export function estimateExerciseSeconds(ex: ExercisePrescription, cfg: TimeModelConfig): number {
  const sets = Math.max(0, ex.sets ?? 0);
  if (sets === 0) return 0;

  const workPerSet = estimateWorkSecondsPerSet(ex.reps, cfg);
  const betweenSetsRest =
    typeof ex.rest_seconds === "number" && ex.rest_seconds >= 0
      ? ex.rest_seconds
      : cfg.restBetweenSetsSeconds;

  // Standard formula: Work for all sets + rest BETWEEN them (no rest after last set)
  return sets * workPerSet + Math.max(0, sets - 1) * betweenSetsRest;
}

/**
 * Estimate session seconds including between-exercise transitions.
 */
export function estimateSessionSeconds(session: SessionBlueprint, cfg: TimeModelConfig): number {
  const ordered: Array<{ blockType: BlockType; ex: ExercisePrescription }> = [];
  for (const b of session.blocks) {
    for (const ex of b.exercises) ordered.push({ blockType: b.type, ex });
  }

  let total = 0;
  for (let i = 0; i < ordered.length; i++) {
    total += estimateExerciseSeconds(ordered[i].ex, cfg);
    if (i !== ordered.length - 1) total += cfg.restBetweenExercisesSeconds;
  }

  const hasWarmup = session.blocks.some((b) => b.type === "warmup");
  const hasCooldown = session.blocks.some((b) => b.type === "cooldown");
  if (!hasWarmup && cfg.warmupMinutesDefault) total += cfg.warmupMinutesDefault * 60;
  if (!hasCooldown && cfg.cooldownMinutesDefault) total += cfg.cooldownMinutesDefault * 60;

  return total;
}

type IndexedExercise = {
  blockIndex: number;
  exerciseIndex: number;
  blockType: BlockType;
  ex: ExercisePrescription;
};

function listExercises(session: SessionBlueprint): IndexedExercise[] {
  const items: IndexedExercise[] = [];
  session.blocks.forEach((b, bi) => {
    b.exercises.forEach((ex, ei) => {
      items.push({ blockIndex: bi, exerciseIndex: ei, blockType: b.type, ex });
    });
  });
  return items;
}

function getCaps(exerciseId: string, capsMap?: Record<string, ExerciseCaps>): ExerciseCaps {
  return capsMap?.[exerciseId] ?? {};
}

function blockShrinkRank(t: BlockType): number {
  // shrink cardio/accessory first, protect main
  if (t === "cardio") return 0;
  if (t === "accessory") return 1;
  if (t === "warmup") return 2;
  if (t === "cooldown") return 3;
  return 4; // main
}

function blockExpandRank(t: BlockType): number {
  // expand accessory first, then main, then cardio
  if (t === "accessory") return 0;
  if (t === "main") return 1;
  if (t === "cardio") return 2;
  return 3;
}

/**
 * Fit a single session into [allowedMinMinutes, allowedMaxMinutes].
 *
 * Policy:
 * - Shrink: reduce sets on priority 3 then 2 (never priority 1). If still too long, remove priority 3 exercises
 *   (by default: never remove from main block).
 * - Expand: add sets to priority 2 then 3 (never priority 1) up to caps.
 */
export function fitSessionToDuration(params: {
  session: SessionBlueprint;
  cfg: TimeModelConfig;
  targetMinutes: number;
  allowedMinMinutes: number;
  allowedMaxMinutes: number;
  capsMap?: Record<string, ExerciseCaps>;
  allowRemoveFromMain?: boolean; // default false
}): FitResult {
  const {
    session,
    cfg,
    targetMinutes,
    allowedMinMinutes,
    allowedMaxMinutes,
    capsMap,
    allowRemoveFromMain = false,
  } = params;

  const s = clone(session);
  const actions: FitAction[] = [];

  const estimateMinutes = () => minutesFromSeconds(estimateSessionSeconds(s, cfg));
  const before = estimateMinutes();

  const tryReduceOneSet = (it: IndexedExercise): boolean => {
    const ex = it.ex;
    if (ex.priority === 1) return false;
    const { minSets = 1 } = getCaps(ex.exercise_id, capsMap);
    if (ex.sets > minSets) {
      const from = ex.sets;
      ex.sets -= 1;
      actions.push({
        action: "reduce_sets",
        exercise_id: ex.exercise_id,
        block_type: it.blockType,
        from_sets: from,
        to_sets: ex.sets,
        delta_sets: -1,
      });
      return true;
    }
    return false;
  };

  const tryAddOneSet = (it: IndexedExercise): boolean => {
    const ex = it.ex;
    if (ex.priority === 1) return false;
    const { maxSets = 6 } = getCaps(ex.exercise_id, capsMap);
    if (ex.sets < maxSets) {
      const from = ex.sets;
      ex.sets += 1;
      actions.push({
        action: "add_sets",
        exercise_id: ex.exercise_id,
        block_type: it.blockType,
        from_sets: from,
        to_sets: ex.sets,
        delta_sets: +1,
      });
      return true;
    }
    return false;
  };

  const removeExercise = (it: IndexedExercise): boolean => {
    const ex = it.ex;
    if (ex.priority !== 3) return false;
    if (!allowRemoveFromMain && it.blockType === "main") return false;
    s.blocks[it.blockIndex].exercises.splice(it.exerciseIndex, 1);
    actions.push({ action: "remove_exercise", exercise_id: ex.exercise_id, block_type: it.blockType });
    return true;
  };

  // Shrink loop
  let guard = 0;
  while (estimateMinutes() > allowedMaxMinutes && guard++ < 500) {
    let changed = false;
    const items = listExercises(s)
      .filter((x) => (x.ex.sets ?? 0) > 0)
      .sort((a, b) => {
        if (a.ex.priority !== b.ex.priority) return b.ex.priority - a.ex.priority; // 3 -> 2 -> 1
        return blockShrinkRank(a.blockType) - blockShrinkRank(b.blockType);
      });

    for (const it of items) {
      if (tryReduceOneSet(it)) {
        changed = true;
        break;
      }
    }
    if (changed) continue;

    // remove priority 3 exercises (non-main by default)
    const candidates = listExercises(s)
      .filter((x) => x.ex.priority === 3)
      .sort((a, b) => blockShrinkRank(a.blockType) - blockShrinkRank(b.blockType));

    for (const it of candidates) {
      // indices may shift, find fresh reference
      const fresh = listExercises(s).find(
        (x) => x.ex.exercise_id === it.ex.exercise_id && x.blockType === it.blockType
      );
      if (fresh && removeExercise(fresh)) {
        changed = true;
        break;
      }
    }

    if (!changed) break;
  }

  // Expand loop
  guard = 0;
  while (estimateMinutes() < allowedMinMinutes && guard++ < 500) {
    let changed = false;
    const items = listExercises(s)
      .filter((x) => x.ex.priority !== 1)
      .sort((a, b) => {
        // expand priority 2 first, then 3
        if (a.ex.priority !== b.ex.priority) return a.ex.priority - b.ex.priority;
        return blockExpandRank(a.blockType) - blockExpandRank(b.blockType);
      });

    for (const it of items) {
      if (tryAddOneSet(it)) {
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }

  const after = estimateMinutes();
  const ok = after >= allowedMinMinutes && after <= allowedMaxMinutes;

  return {
    session: s,
    report: {
      before_minutes: round1(before),
      after_minutes: round1(after),
      target_minutes: targetMinutes,
      allowed_min: allowedMinMinutes,
      allowed_max: allowedMaxMinutes,
      actions,
      status: ok ? "ok" : "needs_review",
      note: ok ? undefined : "Could not fit session within allowed range using deterministic rules.",
    },
  };
}

/**
 * Fit multiple sessions.
 */
export function fitProgramSessions(params: {
  sessions: SessionBlueprint[];
  cfg: TimeModelConfig;
  targetMinutes: number;
  allowedMinMinutes: number;
  allowedMaxMinutes: number;
  capsMap?: Record<string, ExerciseCaps>;
  allowRemoveFromMain?: boolean;
}): { sessions: SessionBlueprint[]; reports: FitReport[] } {
  const results = params.sessions.map((s) =>
    fitSessionToDuration({
      session: s,
      cfg: params.cfg,
      targetMinutes: params.targetMinutes,
      allowedMinMinutes: params.allowedMinMinutes,
      allowedMaxMinutes: params.allowedMaxMinutes,
      capsMap: params.capsMap,
      allowRemoveFromMain: params.allowRemoveFromMain,
    })
  );

  return {
    sessions: results.map((r) => r.session),
    reports: results.map((r) => r.report),
  };
}
