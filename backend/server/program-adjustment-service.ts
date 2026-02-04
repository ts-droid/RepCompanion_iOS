import { db } from "./db";
import {
  programTemplates,
  programTemplateExercises,
  exercises,
  userProfiles,
  userEquipment
} from "@shared/schema";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { storage } from "./storage";
import { estimateExerciseSeconds, TimeModelConfig } from "./utils/timeFitting";

/**
 * Muscle group balance analysis result
 */
export interface MuscleGroupStats {
  muscleGroup: string;
  exerciseCount: number;
  totalSets: number;
  percentage: number;
}

export interface MuscleGroupAnalysis {
  stats: MuscleGroupStats[];
  totalExercises: number;
  totalSets: number;
  avgExercisesPerMuscle: number;
}

/**
 * Estimate time for a single set including work and rest.
 * Uses V4 time model if available, otherwise fallbacks.
 */
function getExerciseCost(exercise: any, cfg: TimeModelConfig): number {
  return estimateExerciseSeconds({
    exercise_id: exercise.exerciseKey || exercise.exercise_id,
    sets: exercise.targetSets || 3,
    reps: exercise.targetReps || "10",
    rest_seconds: exercise.restSeconds || null,
    load_type: "fixed", // default for adjustment
    load_value: 0,
    priority: 2
  }, cfg) / 60; // Returns minutes
}

/**
 * Analyze muscle group balance in user's current program
 */
export async function analyzeMuscleGroupBalance(userId: string): Promise<MuscleGroupAnalysis> {
  const userTemplates = await db
    .select({ id: programTemplates.id })
    .from(programTemplates)
    .where(eq(programTemplates.userId, userId));

  if (userTemplates.length === 0) {
    return { stats: [], totalExercises: 0, totalSets: 0, avgExercisesPerMuscle: 0 };
  }

  const templateIds = userTemplates.map(t => t.id);

  const programExercises = await db
    .select({
      muscles: programTemplateExercises.muscles,
      targetSets: programTemplateExercises.targetSets,
    })
    .from(programTemplateExercises)
    .where(inArray(programTemplateExercises.templateId, templateIds));

  const muscleGroupMap = new Map<string, { count: number; sets: number }>();
  let totalExercises = programExercises.length;
  let totalSets = 0;

  for (const exercise of programExercises) {
    const sets = exercise.targetSets || 3;
    totalSets += sets;

    if (exercise.muscles && exercise.muscles.length > 0) {
      const contribution = 1 / exercise.muscles.length;
      const setsPerMuscle = sets / exercise.muscles.length;

      for (const muscle of exercise.muscles) {
        const current = muscleGroupMap.get(muscle) || { count: 0, sets: 0 };
        muscleGroupMap.set(muscle, {
          count: current.count + contribution,
          sets: current.sets + setsPerMuscle,
        });
      }
    }
  }

  const stats: MuscleGroupStats[] = Array.from(muscleGroupMap.entries())
    .map(([muscleGroup, data]) => ({
      muscleGroup,
      exerciseCount: Math.round(data.count * 10) / 10,
      totalSets: Math.round(data.sets),
      percentage: totalExercises > 0 ? Math.round((data.count / totalExercises) * 100) : 0,
    }))
    .sort((a, b) => b.exerciseCount - a.exerciseCount);

  return {
    stats,
    totalExercises,
    totalSets,
    avgExercisesPerMuscle: muscleGroupMap.size > 0 ? totalExercises / muscleGroupMap.size : 0,
  };
}

/**
 * Resequence orderIndex for a template to ensure no gaps
 */
async function resequenceTemplate(templateId: string) {
  const templateExercises = await db
    .select()
    .from(programTemplateExercises)
    .where(eq(programTemplateExercises.templateId, templateId))
    .orderBy(programTemplateExercises.orderIndex);

  for (let i = 0; i < templateExercises.length; i++) {
    const ex = templateExercises[i];
    if (ex.orderIndex !== i) {
      await db
        .update(programTemplateExercises)
        .set({ orderIndex: i })
        .where(eq(programTemplateExercises.id, ex.id));
    }
  }
}

/**
 * Adjust program duration locally
 */
export async function adjustProgramDuration(
  userId: string,
  newDuration: number,
  selectedGymId?: string
): Promise<void> {
  const analysis = await analyzeMuscleGroupBalance(userId);
  if (analysis.totalExercises === 0) throw new Error("No program found");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId)
  });
  if (!profile) throw new Error("Profile not found");

  const timeModel = await storage.getUserTimeModel(userId) || {
    workSecondsPer10Reps: 30,
    restBetweenSetsSeconds: 90,
    restBetweenExercisesSeconds: 120,
    warmupMinutesDefault: 8,
    cooldownMinutesDefault: 5,
  };

  const currentDuration = profile.sessionDuration || 60;
  const durationDiff = newDuration - currentDuration;
  
  // Use a sample exercise to estimate average cost in minutes
  const avgExerciseMinutes = getExerciseCost({ targetSets: 3, targetReps: "10" }, timeModel) + (timeModel.restBetweenExercisesSeconds / 60);
  const exerciseAdjustment = Math.round(durationDiff / avgExerciseMinutes);

  if (exerciseAdjustment === 0) return;

  const userTemplates = await db
    .select()
    .from(programTemplates)
    .where(eq(programTemplates.userId, userId));

  if (exerciseAdjustment > 0) {
    await addExercises(userId, exerciseAdjustment, analysis, userTemplates, selectedGymId);
  } else {
    await removeExercises(userId, Math.abs(exerciseAdjustment), analysis, userTemplates);
  }

  // Update template estimates
  const durationPerTemplate = Math.round(newDuration / Math.max(userTemplates.length, 1));
  for (const template of userTemplates) {
    await db
      .update(programTemplates)
      .set({ estimatedDurationMinutes: durationPerTemplate })
      .where(eq(programTemplates.id, template.id));
    await resequenceTemplate(template.id);
  }
}

async function addExercises(
  userId: string, 
  count: number, 
  analysis: MuscleGroupAnalysis, 
  templates: any[], 
  gymId?: string
) {
  // Get equipment
  const equip = await db.query.userEquipment.findMany({
    where: gymId 
      ? and(eq(userEquipment.userId, userId), eq(userEquipment.gymId, gymId))
      : eq(userEquipment.userId, userId)
  });
  const equipNames = equip.map(e => e.equipmentName.toLowerCase());

  // Underrepresented muscles
  const targets = analysis.stats
    .filter(s => s.exerciseCount < analysis.avgExercisesPerMuscle)
    .map(s => s.muscleGroup);

  const pool = await db
    .select()
    .from(exercises)
    .where(sql`${exercises.primaryMuscles} && ${targets.length > 0 ? targets : analysis.stats.map(s => s.muscleGroup)}::text[]`)
    .limit(count * 5);

  const filtered = pool.filter(ex => {
    if (!ex.requiredEquipment?.length) return true;
    return ex.requiredEquipment.some(req => 
      req.toLowerCase() === "bodyweight" || equipNames.some(e => e.includes(req.toLowerCase()))
    );
  });

  for (let i = 0; i < Math.min(count, filtered.length); i++) {
    const ex = filtered[i];
    const template = templates[i % templates.length];
    
    // Find exercises in this template
    const current = await db.select().from(programTemplateExercises).where(eq(programTemplateExercises.templateId, template.id)).orderBy(programTemplateExercises.orderIndex);
    
    // Try to find the first "cooldown" exercise to insert BEFORE it
    // If no cooldown, just append
    let insertAt = current.length;
    const cooldownIdx = current.findIndex(e => e.exerciseName?.toLowerCase().includes("stretch") || e.exerciseName?.toLowerCase().includes("cooldown") || e.exerciseName?.toLowerCase().includes("nedvarvning"));
    
    if (cooldownIdx !== -1) {
      insertAt = cooldownIdx;
      // Increment orderIndex of subsequent exercises
      await db.update(programTemplateExercises)
        .set({ orderIndex: sql`${programTemplateExercises.orderIndex} + 1` })
        .where(and(eq(programTemplateExercises.templateId, template.id), sql`${programTemplateExercises.orderIndex} >= ${insertAt}`));
    }

    await db.insert(programTemplateExercises).values({
      templateId: template.id,
      exerciseKey: ex.exerciseId || ex.name,
      exerciseName: ex.name,
      orderIndex: insertAt,
      targetSets: 3,
      targetReps: "10-12",
      muscles: ex.primaryMuscles,
      requiredEquipment: ex.requiredEquipment,
      notes: "Auto-added duration adjustment"
    });
  }
}

async function removeExercises(userId: string, count: number, analysis: MuscleGroupAnalysis, templates: any[]) {
  const overrepresented = analysis.stats
    .filter(s => s.exerciseCount > analysis.avgExercisesPerMuscle)
    .map(s => s.muscleGroup);

  const ids = templates.map(t => t.id);
  const exes = await db
    .select()
    .from(programTemplateExercises)
    .where(inArray(programTemplateExercises.templateId, ids))
    .orderBy(desc(programTemplateExercises.orderIndex));

  // Filter to avoid removing warmup/cooldown
  const mainExercises = exes.filter(e => {
    const name = e.exerciseName?.toLowerCase() || "";
    return !name.includes("warmup") && !name.includes("uppvärmning") && 
           !name.includes("stretch") && !name.includes("cooldown") && !name.includes("nedvarvning");
  });

  const toRemove: string[] = [];
  for (const ex of mainExercises) {
    if (toRemove.length >= count) break;
    if (ex.muscles?.some(m => overrepresented.includes(m))) {
      toRemove.push(ex.id);
    }
  }

  // Fallback: remove from end of mainExercises if not enough found
  if (toRemove.length < count) {
    for (const ex of mainExercises) {
      if (toRemove.length >= count) break;
      if (!toRemove.includes(ex.id)) toRemove.push(ex.id);
    }
  }

  if (toRemove.length > 0) {
    await db.delete(programTemplateExercises).where(inArray(programTemplateExercises.id, toRemove));
  }
}
