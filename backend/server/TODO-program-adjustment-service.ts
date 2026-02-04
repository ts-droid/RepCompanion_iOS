/**
 * TODO: LOCAL PROGRAM ADJUSTMENT SERVICE (NOT PRODUCTION READY)
 *
 * This file contains an initial implementation of local program duration adjustment
 * to avoid AI regeneration for minor duration changes. However, architect review
 * identified critical issues that must be resolved before production use.
 *
 * CRITICAL ISSUES IDENTIFIED BY ARCHITECT:
 *
 * 1. VOLUME MANAGEMENT MISSING:
 *    - adjustProgramDuration() only counts exercise count, not sets/reps/volume
 *    - Duration calculations don't account for actual training time per exercise
 *    - Add/remove operations ignore targetSets/targetReps, causing volume drift
 *    - Solution: Implement volume-based budgeting (sets × reps × rest time)
 *
 * 2. TEMPLATE STRUCTURE IGNORED:
 *    - addExercisesToProgram() injects exercises without respecting workout structure
 *    - Ignores warmup → main → cooldown ordering
 *    - Breaks weekly session split and progression logic
 *    - Solution: Work at template/session granularity with explicit structure preservation
 *
 * 3. ORDER INDEX GAPS:
 *    - removeExercisesFromProgram() deletes exercises but doesn't resequence orderIndex
 *    - Leaves gaps that break UI sorting and future insertions
 *    - Solution: Atomic orderIndex updates after add/remove operations
 *
 * RECOMMENDED REDESIGN:
 *
 * 1. Volume-based budgeting:
 *    - Calculate time budget per session: (sessionDuration / templates.length)
 *    - Estimate time per exercise: sets × reps × 3s + rest × (sets-1)
 *    - Add/remove exercises to match time budget while preserving balance
 *
 * 2. Template-aware operations:
 *    - Preserve session metadata (focus, progression, split type)
 *    - Respect exercise ordering (compound first, isolation last)
 *    - Maintain weekly structure (push/pull/legs, upper/lower, etc.)
 *
 * 3. Atomic database operations:
 *    - Use transactions for add/remove + orderIndex resequencing
 *    - Validate program integrity after modifications
 *    - Rollback on validation failures
 *
 * CURRENT STATUS: Reverted from production use
 * - Duration changes now trigger AI regeneration (safe, tested)
 * - This file preserved as reference for future robust implementation
 * - Estimated effort for robust solution: 2.5-3.5 hours
 *
 * See replit.md "Future Work" section for full implementation plan.
 */

import { db } from "./db";
import {
  programTemplates,
  programTemplateExercises,
  exercises,
} from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

/**
 * Muscle group balance analysis result
 */
interface MuscleGroupStats {
  muscleGroup: string;
  exerciseCount: number;
  totalSets: number;
  percentage: number;
}

interface MuscleGroupAnalysis {
  stats: MuscleGroupStats[];
  totalExercises: number;
  totalSets: number;
  avgExercisesPerMuscle: number;
}

/**
 * Analyze muscle group balance in user's current program
 */
export async function analyzeMusclGroupBalance(
  userId: string,
): Promise<MuscleGroupAnalysis> {
  // Get all exercises from user's program templates
  const userTemplates = await db
    .select({ id: programTemplates.id })
    .from(programTemplates)
    .where(eq(programTemplates.userId, userId));

  if (userTemplates.length === 0) {
    return {
      stats: [],
      totalExercises: 0,
      totalSets: 0,
      avgExercisesPerMuscle: 0,
    };
  }

  const templateIds = userTemplates.map((t: any) => t.id);

  const programExercises = await db
    .select({
      exerciseName: programTemplateExercises.exerciseName,
      muscles: programTemplateExercises.muscles,
      targetSets: programTemplateExercises.targetSets,
    })
    .from(programTemplateExercises)
    .where(inArray(programTemplateExercises.templateId, templateIds));

  // Count exercises and sets per muscle group
  const muscleGroupMap = new Map<string, { count: number; sets: number }>();
  let totalExercises = programExercises.length;
  let totalSets = 0;

  for (const exercise of programExercises) {
    const sets = exercise.targetSets || 3;
    totalSets += sets;

    if (exercise.muscles && exercise.muscles.length > 0) {
      // Each exercise contributes proportionally to each muscle group it targets
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

  // Convert to stats array
  const stats: MuscleGroupStats[] = Array.from(muscleGroupMap.entries())
    .map(([muscleGroup, data]) => ({
      muscleGroup,
      exerciseCount: Math.round(data.count * 10) / 10, // Round to 1 decimal
      totalSets: Math.round(data.sets),
      percentage:
        totalExercises > 0
          ? Math.round((data.count / totalExercises) * 100)
          : 0,
    }))
    .sort((a, b) => b.exerciseCount - a.exerciseCount);

  return {
    stats,
    totalExercises,
    totalSets,
    avgExercisesPerMuscle:
      muscleGroupMap.size > 0 ? totalExercises / muscleGroupMap.size : 0,
  };
}

/**
 * Calculate how many exercises to add/remove based on duration change
 */
function calculateExerciseAdjustment(
  currentDuration: number,
  newDuration: number,
  currentExerciseCount: number,
): number {
  // Estimate ~4-6 minutes per exercise (including sets, reps, rest)
  const minutesPerExercise = 5;
  const durationDiff = newDuration - currentDuration;
  const exerciseAdjustment = Math.round(durationDiff / minutesPerExercise);

  return exerciseAdjustment;
}

/**
 * Adjust program duration locally without AI regeneration
 * - Increases duration: Adds exercises proportionally to underrepresented muscle groups
 * - Decreases duration: Removes exercises from overrepresented muscle groups
 */
export async function adjustProgramDuration(
  userId: string,
  newDuration: number,
  selectedGymId?: string,
): Promise<void> {
  // Get current program analysis
  const analysis = await analyzeMusclGroupBalance(userId);

  if (analysis.totalExercises === 0) {
    throw new Error("No existing program found to adjust");
  }

  // Get user profile to find current duration
  const userProfile = await db.query.userProfiles.findFirst({
    where: (profiles: any, { eq }: any) => eq(profiles.userId, userId),
  });

  if (!userProfile) {
    throw new Error("User profile not found");
  }

  const currentDuration = userProfile.sessionDuration || 60;
  const exerciseAdjustment = calculateExerciseAdjustment(
    currentDuration,
    newDuration,
    analysis.totalExercises,
  );

  // No adjustment needed if change is too small
  if (exerciseAdjustment === 0) {
    return;
  }

  // Get all user templates
  const userTemplates = await db
    .select()
    .from(programTemplates)
    .where(eq(programTemplates.userId, userId));

  if (exerciseAdjustment > 0) {
    // ADD exercises - prioritize underrepresented muscle groups
    await addExercisesToProgram(
      userId,
      exerciseAdjustment,
      analysis,
      selectedGymId,
    );
  } else {
    // REMOVE exercises - prioritize overrepresented muscle groups
    await removeExercisesFromProgram(
      userId,
      Math.abs(exerciseAdjustment),
      analysis,
    );
  }

  // Update estimated duration for all templates
  const durationPerTemplate = Math.round(
    newDuration / Math.max(userTemplates.length, 1),
  );
  for (const template of userTemplates) {
    await db
      .update(programTemplates)
      .set({ estimatedDurationMinutes: durationPerTemplate })
      .where(eq(programTemplates.id, template.id));
  }
}

/**
 * Add exercises to program targeting underrepresented muscle groups
 */
async function addExercisesToProgram(
  userId: string,
  count: number,
  analysis: MuscleGroupAnalysis,
  selectedGymId?: string,
): Promise<void> {
  // Get user's available equipment
  const userEquipment = await db.query.userEquipment.findMany({
    where: (equipment: any, { eq, and }: any) =>
      selectedGymId
        ? and(eq(equipment.userId, userId), eq(equipment.gymId, selectedGymId))
        : eq(equipment.userId, userId),
  });

  const availableEquipmentTypes = userEquipment.map(
    (e: any) => e.equipmentName,
  );

  // Find underrepresented muscle groups (below average)
  const avgExercisesPerMuscle = analysis.avgExercisesPerMuscle;
  const underrepresentedMuscles = analysis.stats
    .filter((stat) => stat.exerciseCount < avgExercisesPerMuscle)
    .map((stat) => stat.muscleGroup);

  // If no underrepresented muscles, target all muscles proportionally
  const targetMuscles =
    underrepresentedMuscles.length > 0
      ? underrepresentedMuscles
      : analysis.stats.map((s: any) => s.muscleGroup);

  // Get suitable exercises from catalog
  const suitableExercises = await db
    .select()
    .from(exercises)
    .where(sql`${exercises.primaryMuscles} && ${targetMuscles}::text[]`)
    .limit(count * 3); // Get extra options

  // Filter by available equipment
  const matchingExercises = suitableExercises.filter((ex: any) => {
    if (!ex.requiredEquipment || ex.requiredEquipment.length === 0) return true;
    return ex.requiredEquipment.some(
      (req: any) =>
        req.toLowerCase() === "bodyweight" ||
        availableEquipmentTypes.some((avail: any) =>
          avail.toLowerCase().includes(req.toLowerCase()),
        ),
    );
  });

  // Get user's templates to distribute new exercises across
  const userTemplates = await db
    .select()
    .from(programTemplates)
    .where(eq(programTemplates.userId, userId));

  // Add exercises distributed across templates
  let addedCount = 0;
  for (let i = 0; i < Math.min(count, matchingExercises.length); i++) {
    const exercise = matchingExercises[i];
    const template = userTemplates[i % userTemplates.length];

    // Get current max order index for this template
    const maxOrderResult = await db
      .select({
        maxOrder: sql<number>`COALESCE(MAX(${programTemplateExercises.orderIndex}), 0)`,
      })
      .from(programTemplateExercises)
      .where(eq(programTemplateExercises.templateId, template.id));

    const nextOrderIndex = (maxOrderResult[0]?.maxOrder || 0) + 1;

    // Add exercise to template
    await db.insert(programTemplateExercises).values({
      templateId: template.id,
      exerciseKey: exercise.nameEn || exercise.name,
      exerciseName: exercise.nameEn || exercise.name,
      orderIndex: nextOrderIndex,
      targetSets: 3,
      targetReps: "10-12",
      requiredEquipment: exercise.requiredEquipment,
      muscles: exercise.primaryMuscles,
      notes: "Added by duration adjustment",
    });

    addedCount++;
  }
}

/**
 * Remove exercises from program targeting overrepresented muscle groups
 */
async function removeExercisesFromProgram(
  userId: string,
  count: number,
  analysis: MuscleGroupAnalysis,
): Promise<void> {
  // Find overrepresented muscle groups (above average)
  const avgExercisesPerMuscle = analysis.avgExercisesPerMuscle;
  const overrepresentedMuscles = analysis.stats
    .filter((stat) => stat.exerciseCount > avgExercisesPerMuscle)
    .map((stat) => stat.muscleGroup);

  // Get all program exercises
  const userTemplates = await db
    .select({ id: programTemplates.id })
    .from(programTemplates)
    .where(eq(programTemplates.userId, userId));

  const templateIds = userTemplates.map((t: any) => t.id);

  const programExercises = await db
    .select()
    .from(programTemplateExercises)
    .where(inArray(programTemplateExercises.templateId, templateIds))
    .orderBy(programTemplateExercises.orderIndex);

  // Find exercises to remove - prioritize those targeting overrepresented muscles
  const exercisesToRemove: string[] = [];

  // First, try to remove exercises targeting overrepresented muscles
  for (const exercise of programExercises) {
    if (exercisesToRemove.length >= count) break;

    if (
      exercise.muscles &&
      exercise.muscles.some((m: any) => overrepresentedMuscles.includes(m))
    ) {
      exercisesToRemove.push(exercise.id);
    }
  }

  // If not enough, remove from end of program (least important)
  if (exercisesToRemove.length < count) {
    const remaining = count - exercisesToRemove.length;
    const lastExercises = programExercises
      .filter((ex: any) => !exercisesToRemove.includes(ex.id))
      .slice(-remaining);

    exercisesToRemove.push(...lastExercises.map((ex: any) => ex.id));
  }

  // Remove selected exercises
  if (exercisesToRemove.length > 0) {
    await db
      .delete(programTemplateExercises)
      .where(inArray(programTemplateExercises.id, exercisesToRemove));
  }
}
