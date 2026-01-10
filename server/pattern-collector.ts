/**
 * Pattern Collector Service
 * 
 * Extracts and caches patterns from AI-generated workout programs
 * to enable future local generation without AI queries.
 */

import { db } from "./db";
import { 
  aiProgramPatterns, 
  exerciseSelectionRules, 
  equipmentSubstitutions,
  type InsertAiProgramPattern,
  type InsertExerciseSelectionRule
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import * as crypto from "crypto";

// Types for AI response structure
interface AIWorkoutSession {
  session_name: string;
  target_muscle_focus: string;
  exercises: AIExercise[];
}

interface AIExercise {
  exercise_name: string;
  target_muscles?: string[];
  sets?: number;
  reps?: string | number;
  rest_seconds?: number;
  equipment_required?: string[];
  technique_cues?: string[];
  suggested_weight_kg?: number;
  tempo?: string;
}

interface AIProgram {
  training_split?: string;
  weekly_structure?: string;
  sessions?: AIWorkoutSession[];
  warmup_routine?: any;
  cooldown_routine?: any;
}

interface PatternCollectorOptions {
  aiProvider: string;
  aiModel?: string;
  generationTimeMs?: number;
}

/**
 * Generate a hash of the equipment list for pattern matching
 */
function generateEquipmentHash(equipment: string[]): string {
  const sorted = [...equipment].sort().map(e => e.toLowerCase().trim());
  return crypto.createHash('sha256').update(sorted.join('|')).digest('hex');
}

/**
 * Extract program structure from AI response
 */
function extractProgramStructure(aiResponse: AIProgram): object {
  return {
    trainingSplit: aiResponse.training_split || 'unknown',
    weeklyStructure: aiResponse.weekly_structure || null,
    sessionCount: aiResponse.sessions?.length || 0,
    hasWarmup: !!aiResponse.warmup_routine,
    hasCooldown: !!aiResponse.cooldown_routine,
  };
}

/**
 * Extract workout templates from AI response
 */
function extractWorkoutTemplates(aiResponse: AIProgram): object[] {
  if (!aiResponse.sessions) return [];
  
  return aiResponse.sessions.map(session => ({
    name: session.session_name,
    muscleFocus: session.target_muscle_focus,
    exerciseCount: session.exercises?.length || 0,
    exercises: session.exercises?.map(ex => ({
      name: ex.exercise_name,
      muscles: ex.target_muscles || [],
      sets: ex.sets || 3,
      reps: ex.reps || '8-12',
      restSeconds: ex.rest_seconds || 90,
      equipment: ex.equipment_required || [],
    })) || [],
  }));
}

/**
 * Save a new pattern or update existing one if similar pattern exists
 */
export async function savePattern(
  aiResponse: AIProgram,
  userProfile: {
    trainingGoal: string;
    trainingLevel: string;
    daysPerWeek: number;
    sessionDuration: number;
    goalStrength?: number;
    goalVolume?: number;
    goalEndurance?: number;
    goalCardio?: number;
    equipment: string[];
  },
  options: PatternCollectorOptions
): Promise<string | null> {
  try {
    const equipmentHash = generateEquipmentHash(userProfile.equipment);
    
    // Check if a similar pattern already exists
    const existing = await db
      .select()
      .from(aiProgramPatterns)
      .where(
        and(
          eq(aiProgramPatterns.trainingGoal, userProfile.trainingGoal),
          eq(aiProgramPatterns.trainingLevel, userProfile.trainingLevel),
          eq(aiProgramPatterns.daysPerWeek, userProfile.daysPerWeek),
          eq(aiProgramPatterns.equipmentHash, equipmentHash)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update usage count on existing pattern
      await db
        .update(aiProgramPatterns)
        .set({
          usageCount: sql`${aiProgramPatterns.usageCount} + 1`,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiProgramPatterns.id, existing[0].id));
      
      console.log(`[PATTERN COLLECTOR] Updated existing pattern: ${existing[0].id}`);
      return existing[0].id;
    }
    
    // Create new pattern
    const programStructure = extractProgramStructure(aiResponse);
    const workoutTemplates = extractWorkoutTemplates(aiResponse);
    
    const newPattern: InsertAiProgramPattern = {
      trainingGoal: userProfile.trainingGoal,
      trainingLevel: userProfile.trainingLevel,
      daysPerWeek: userProfile.daysPerWeek,
      sessionDuration: userProfile.sessionDuration,
      equipmentHash,
      goalStrength: userProfile.goalStrength ?? 50,
      goalVolume: userProfile.goalVolume ?? 50,
      goalEndurance: userProfile.goalEndurance ?? 50,
      goalCardio: userProfile.goalCardio ?? 50,
      programStructure,
      workoutTemplates,
      rawAiResponse: aiResponse,
      aiProvider: options.aiProvider,
      aiModel: options.aiModel || null,
      generationTimeMs: options.generationTimeMs || null,
    };
    
    const [inserted] = await db
      .insert(aiProgramPatterns)
      .values(newPattern)
      .returning({ id: aiProgramPatterns.id });
    
    console.log(`[PATTERN COLLECTOR] Saved new pattern: ${inserted.id}`);
    
    // Also extract exercise selection rules
    await updateExerciseSelectionRulesFromProgram(aiResponse, userProfile.trainingGoal, userProfile.trainingLevel);
    
    return inserted.id;
  } catch (error) {
    console.error('[PATTERN COLLECTOR] Error saving pattern:', error);
    return null;
  }
}

/**
 * Update exercise selection rules based on AI choices
 */
async function updateExerciseSelectionRulesFromProgram(
  aiResponse: AIProgram,
  trainingGoal: string,
  trainingLevel: string
): Promise<void> {
  if (!aiResponse.sessions) return;
  
  for (const session of aiResponse.sessions) {
    const exercises = session.exercises || [];
    let priority = 1;
    
    for (const exercise of exercises) {
      const muscles = exercise.target_muscles || [];
      
      for (const muscle of muscles) {
        await upsertExerciseSelectionRule({
          targetMuscle: muscle.toLowerCase(),
          trainingGoal,
          trainingLevel,
          exerciseName: exercise.exercise_name,
          requiredEquipment: exercise.equipment_required || [],
          defaultSets: exercise.sets || 3,
          defaultReps: String(exercise.reps || '8-12'),
          defaultRestSeconds: exercise.rest_seconds || 90,
          priority,
        });
      }
      
      priority++;
    }
  }
}

/**
 * Insert or update an exercise selection rule
 */
async function upsertExerciseSelectionRule(rule: {
  targetMuscle: string;
  trainingGoal: string;
  trainingLevel: string;
  exerciseName: string;
  requiredEquipment: string[];
  defaultSets: number;
  defaultReps: string;
  defaultRestSeconds: number;
  priority: number;
}): Promise<void> {
  try {
    // Check if rule exists
    const existing = await db
      .select()
      .from(exerciseSelectionRules)
      .where(
        and(
          eq(exerciseSelectionRules.targetMuscle, rule.targetMuscle),
          eq(exerciseSelectionRules.trainingGoal, rule.trainingGoal),
          eq(exerciseSelectionRules.trainingLevel, rule.trainingLevel),
          eq(exerciseSelectionRules.exerciseName, rule.exerciseName)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Increment selection count
      await db
        .update(exerciseSelectionRules)
        .set({
          selectionCount: sql`${exerciseSelectionRules.selectionCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(exerciseSelectionRules.id, existing[0].id));
    } else {
      // Create new rule
      await db.insert(exerciseSelectionRules).values({
        targetMuscle: rule.targetMuscle,
        trainingGoal: rule.trainingGoal,
        trainingLevel: rule.trainingLevel,
        exerciseName: rule.exerciseName,
        requiredEquipment: rule.requiredEquipment,
        defaultSets: rule.defaultSets,
        defaultReps: rule.defaultReps,
        defaultRestSeconds: rule.defaultRestSeconds,
        priority: rule.priority,
      });
    }
  } catch (error) {
    // Ignore duplicate errors silently
    if (!String(error).includes('duplicate')) {
      console.error('[PATTERN COLLECTOR] Error upserting selection rule:', error);
    }
  }
}

/**
 * Save an equipment substitution rule
 */
export async function saveEquipmentSubstitution(
  originalEquipment: string,
  substituteEquipment: string,
  options?: {
    exerciseContext?: string;
    muscleContext?: string;
    weightAdjustment?: number;
    notes?: string;
  }
): Promise<void> {
  try {
    // Check if substitution exists
    const existing = await db
      .select()
      .from(equipmentSubstitutions)
      .where(
        and(
          eq(equipmentSubstitutions.originalEquipment, originalEquipment.toLowerCase()),
          eq(equipmentSubstitutions.substituteEquipment, substituteEquipment.toLowerCase())
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Increment usage count
      await db
        .update(equipmentSubstitutions)
        .set({
          usageCount: sql`${equipmentSubstitutions.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(equipmentSubstitutions.id, existing[0].id));
    } else {
      // Create new substitution
      await db.insert(equipmentSubstitutions).values({
        originalEquipment: originalEquipment.toLowerCase(),
        substituteEquipment: substituteEquipment.toLowerCase(),
        exerciseContext: options?.exerciseContext || null,
        muscleContext: options?.muscleContext || null,
        weightAdjustment: options?.weightAdjustment ?? 1.0,
        notes: options?.notes || null,
      });
    }
    
    console.log(`[PATTERN COLLECTOR] Saved substitution: ${originalEquipment} → ${substituteEquipment}`);
  } catch (error) {
    console.error('[PATTERN COLLECTOR] Error saving substitution:', error);
  }
}

/**
 * Get statistics about cached patterns
 */
export async function getPatternStats(): Promise<{
  totalPatterns: number;
  totalSelectionRules: number;
  totalSubstitutions: number;
  topPatterns: any[];
}> {
  try {
    const patterns = await db.select().from(aiProgramPatterns);
    const rules = await db.select().from(exerciseSelectionRules);
    const substitutions = await db.select().from(equipmentSubstitutions);
    
    // Get top 5 most used patterns
    const topPatterns = patterns
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        goal: p.trainingGoal,
        level: p.trainingLevel,
        days: p.daysPerWeek,
        usageCount: p.usageCount,
      }));
    
    return {
      totalPatterns: patterns.length,
      totalSelectionRules: rules.length,
      totalSubstitutions: substitutions.length,
      topPatterns,
    };
  } catch (error) {
    console.error('[PATTERN COLLECTOR] Error getting stats:', error);
    return {
      totalPatterns: 0,
      totalSelectionRules: 0,
      totalSubstitutions: 0,
      topPatterns: [],
    };
  }
}

export default {
  savePattern,
  saveEquipmentSubstitution,
  getPatternStats,
  generateEquipmentHash,
};
