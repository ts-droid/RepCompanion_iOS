/**
 * Local Generator Service
 * 
 * Generates workout programs locally from cached AI patterns,
 * enabling offline/fast program generation without AI API calls.
 */

import { db } from "./db";
import { 
  aiProgramPatterns, 
  exerciseSelectionRules, 
  equipmentSubstitutions,
  exercises,
  type AiProgramPattern,
  type ExerciseSelectionRule,
} from "@shared/schema";
import { eq, and, sql, desc, or, like } from "drizzle-orm";
import * as crypto from "crypto";

// Types for local generation
interface LocalGenerationRequest {
  trainingGoal: string;
  trainingLevel: string;
  daysPerWeek: number;
  sessionDuration: number;
  equipment: string[];
  goalStrength?: number;
  goalVolume?: number;
  goalEndurance?: number;
  goalCardio?: number;
}

interface LocalGenerationResult {
  success: boolean;
  source: 'exact_match' | 'similar_match' | 'rule_based' | 'failed';
  matchScore?: number;
  patternId?: string;
  program?: GeneratedProgram;
  message?: string;
}

interface GeneratedProgram {
  trainingSplit: string;
  weeklyStructure: string | null;
  sessions: GeneratedSession[];
}

interface GeneratedSession {
  name: string;
  muscleFocus: string;
  estimatedDuration: number;
  exercises: GeneratedExercise[];
}

interface GeneratedExercise {
  name: string;
  key: string;
  sets: number;
  reps: string;
  restSeconds: number;
  equipment: string[];
  muscles: string[];
}

/**
 * Generate equipment hash for pattern matching
 */
function generateEquipmentHash(equipment: string[]): string {
  const sorted = [...equipment].sort().map(e => e.toLowerCase().trim());
  return crypto.createHash('sha256').update(sorted.join('|')).digest('hex');
}

/**
 * Calculate similarity score between two equipment lists
 */
function calculateEquipmentSimilarity(userEquipment: string[], patternEquipment: string[]): number {
  if (patternEquipment.length === 0) return 1.0; // No equipment needed
  
  const userSet = new Set(userEquipment.map(e => e.toLowerCase().trim()));
  const patternSet = new Set(patternEquipment.map(e => e.toLowerCase().trim()));
  
  let matches = 0;
  for (const eq of patternSet) {
    if (userSet.has(eq)) matches++;
  }
  
  return matches / patternSet.size;
}

/**
 * Find the best matching cached pattern
 */
async function findBestPattern(request: LocalGenerationRequest): Promise<{
  pattern: AiProgramPattern | null;
  matchType: 'exact' | 'similar' | 'none';
  matchScore: number;
}> {
  const equipmentHash = generateEquipmentHash(request.equipment);
  
  // 1. Try exact match first
  const exactMatch = await db
    .select()
    .from(aiProgramPatterns)
    .where(
      and(
        eq(aiProgramPatterns.trainingGoal, request.trainingGoal),
        eq(aiProgramPatterns.trainingLevel, request.trainingLevel),
        eq(aiProgramPatterns.daysPerWeek, request.daysPerWeek),
        eq(aiProgramPatterns.equipmentHash, equipmentHash)
      )
    )
    .orderBy(desc(aiProgramPatterns.usageCount))
    .limit(1);
  
  if (exactMatch.length > 0) {
    return { pattern: exactMatch[0], matchType: 'exact', matchScore: 1.0 };
  }
  
  // 2. Try similar match (same goal and level, different equipment)
  const similarMatches = await db
    .select()
    .from(aiProgramPatterns)
    .where(
      and(
        eq(aiProgramPatterns.trainingGoal, request.trainingGoal),
        eq(aiProgramPatterns.trainingLevel, request.trainingLevel),
        eq(aiProgramPatterns.daysPerWeek, request.daysPerWeek)
      )
    )
    .orderBy(desc(aiProgramPatterns.usageCount))
    .limit(10);
  
  if (similarMatches.length > 0) {
    // Find the one with best equipment overlap
    let bestMatch = similarMatches[0];
    let bestScore = 0;
    
    for (const pattern of similarMatches) {
      // Extract equipment from workout templates
      const patternEquipment = extractEquipmentFromPattern(pattern);
      const score = calculateEquipmentSimilarity(request.equipment, patternEquipment);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }
    
    if (bestScore >= 0.7) {
      return { pattern: bestMatch, matchType: 'similar', matchScore: bestScore };
    }
  }
  
  // 3. No good match found
  return { pattern: null, matchType: 'none', matchScore: 0 };
}

/**
 * Extract all equipment referenced in a pattern
 */
function extractEquipmentFromPattern(pattern: AiProgramPattern): string[] {
  const equipment = new Set<string>();
  
  const templates = pattern.workoutTemplates as any[];
  if (!templates) return [];
  
  for (const template of templates) {
    const exercises = template.exercises || [];
    for (const exercise of exercises) {
      const eq = exercise.equipment || [];
      eq.forEach((e: string) => equipment.add(e.toLowerCase()));
    }
  }
  
  return Array.from(equipment);
}

/**
 * Generate program from a cached pattern
 */
function generateFromPattern(
  pattern: AiProgramPattern,
  request: LocalGenerationRequest
): GeneratedProgram {
  const structure = pattern.programStructure as any;
  const templates = pattern.workoutTemplates as any[];
  
  const sessions: GeneratedSession[] = templates.map((template, index) => {
    const exercises: GeneratedExercise[] = (template.exercises || []).map((ex: any) => ({
      name: ex.name,
      key: ex.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      sets: ex.sets || 3,
      reps: String(ex.reps || '8-12'),
      restSeconds: ex.restSeconds || 90,
      equipment: ex.equipment || [],
      muscles: ex.muscles || [],
    }));
    
    return {
      name: `Pass ${String.fromCharCode(65 + index)}`, // A, B, C, etc.
      muscleFocus: template.muscleFocus || 'Full Body',
      estimatedDuration: request.sessionDuration,
      exercises,
    };
  });
  
  return {
    trainingSplit: structure?.trainingSplit || 'custom',
    weeklyStructure: structure?.weeklyStructure || null,
    sessions,
  };
}

/**
 * Generate program from exercise selection rules (rule-based fallback)
 */
async function generateFromRules(request: LocalGenerationRequest): Promise<GeneratedProgram | null> {
  // Get all rules matching the training goal and level
  const rules = await db
    .select()
    .from(exerciseSelectionRules)
    .where(
      and(
        eq(exerciseSelectionRules.trainingGoal, request.trainingGoal),
        eq(exerciseSelectionRules.trainingLevel, request.trainingLevel)
      )
    )
    .orderBy(exerciseSelectionRules.priority, desc(exerciseSelectionRules.selectionCount));
  
  if (rules.length < 5) {
    // Not enough rules to generate a meaningful program
    return null;
  }
  
  // Group rules by muscle
  const rulesByMuscle = new Map<string, ExerciseSelectionRule[]>();
  for (const rule of rules) {
    const muscle = rule.targetMuscle;
    if (!rulesByMuscle.has(muscle)) {
      rulesByMuscle.set(muscle, []);
    }
    rulesByMuscle.get(muscle)!.push(rule);
  }
  
  // Create sessions based on days per week
  const sessions: GeneratedSession[] = [];
  const muscleGroups = Array.from(rulesByMuscle.keys());
  
  // Simple split logic
  const splits = getSplitPattern(request.daysPerWeek, muscleGroups);
  
  for (let i = 0; i < request.daysPerWeek; i++) {
    const sessionMuscles = splits[i] || muscleGroups.slice(0, 3);
    const exercises: GeneratedExercise[] = [];
    
    for (const muscle of sessionMuscles) {
      const muscleRules = rulesByMuscle.get(muscle) || [];
      // Take top 2 exercises for each muscle
      const topRules = muscleRules.slice(0, 2);
      
      for (const rule of topRules) {
        // Check if user has required equipment
        const hasEquipment = checkEquipmentAvailable(rule.requiredEquipment || [], request.equipment);
        if (!hasEquipment) continue;
        
        exercises.push({
          name: rule.exerciseName,
          key: rule.exerciseKey || rule.exerciseName.toLowerCase().replace(/\s+/g, '_'),
          sets: rule.defaultSets || 3,
          reps: rule.defaultReps || '8-12',
          restSeconds: rule.defaultRestSeconds || 90,
          equipment: rule.requiredEquipment || [],
          muscles: [muscle],
        });
      }
    }
    
    if (exercises.length > 0) {
      sessions.push({
        name: `Pass ${String.fromCharCode(65 + i)}`,
        muscleFocus: sessionMuscles.join(' & '),
        estimatedDuration: request.sessionDuration,
        exercises: exercises.slice(0, 8), // Max 8 exercises per session
      });
    }
  }
  
  if (sessions.length === 0) {
    return null;
  }
  
  return {
    trainingSplit: 'rule_based',
    weeklyStructure: `${request.daysPerWeek} days per week`,
    sessions,
  };
}

/**
 * Get split pattern based on days per week
 */
function getSplitPattern(daysPerWeek: number, availableMuscles: string[]): string[][] {
  const push = availableMuscles.filter(m => ['chest', 'shoulders', 'triceps', 'bröst', 'axlar'].some(p => m.includes(p)));
  const pull = availableMuscles.filter(m => ['back', 'biceps', 'rygg'].some(p => m.includes(p)));
  const legs = availableMuscles.filter(m => ['legs', 'quads', 'hamstrings', 'glutes', 'ben', 'lår'].some(p => m.includes(p)));
  const core = availableMuscles.filter(m => ['core', 'abs', 'mage'].some(p => m.includes(p)));
  
  switch (daysPerWeek) {
    case 2:
      return [
        [...push, ...pull].slice(0, 4),
        [...legs, ...core].slice(0, 4),
      ];
    case 3:
      return [
        push.slice(0, 3),
        pull.slice(0, 3),
        legs.slice(0, 3),
      ];
    case 4:
      return [
        push.slice(0, 3),
        pull.slice(0, 3),
        legs.slice(0, 3),
        [...push.slice(0, 2), ...core.slice(0, 1)],
      ];
    case 5:
      return [
        push.slice(0, 3),
        pull.slice(0, 3),
        legs.slice(0, 3),
        [...push.slice(0, 2), ...core.slice(0, 1)],
        [...pull.slice(0, 2), ...legs.slice(0, 1)],
      ];
    case 6:
      return [
        push.slice(0, 3),
        pull.slice(0, 3),
        legs.slice(0, 3),
        push.slice(0, 3),
        pull.slice(0, 3),
        legs.slice(0, 3),
      ];
    default:
      return [availableMuscles.slice(0, 4)];
  }
}

/**
 * Check if required equipment is available
 */
function checkEquipmentAvailable(required: string[], available: string[]): boolean {
  if (!required || required.length === 0) return true;
  
  const availableSet = new Set(available.map(e => e.toLowerCase().trim()));
  
  for (const req of required) {
    const normalized = req.toLowerCase().trim();
    // Check for exact match or common aliases
    if (!availableSet.has(normalized)) {
      // Check aliases
      if (normalized === 'barbell' && (availableSet.has('skivstång') || availableSet.has('barbell'))) continue;
      if (normalized === 'dumbbells' && (availableSet.has('hantlar') || availableSet.has('dumbbells'))) continue;
      if (normalized === 'bench' && (availableSet.has('bänk') || availableSet.has('bench'))) continue;
      return false;
    }
  }
  
  return true;
}

/**
 * Main function: Try to generate program locally
 */
export async function generateLocalProgram(request: LocalGenerationRequest): Promise<LocalGenerationResult> {
  try {
    console.log('[LOCAL GENERATOR] Attempting local generation for:', {
      goal: request.trainingGoal,
      level: request.trainingLevel,
      days: request.daysPerWeek,
      equipment: request.equipment.length,
    });
    
    // 1. Try to find a matching cached pattern
    const { pattern, matchType, matchScore } = await findBestPattern(request);
    
    if (pattern && matchType === 'exact') {
      console.log('[LOCAL GENERATOR] ✅ Exact pattern match found!');
      
      // Update usage stats
      await db
        .update(aiProgramPatterns)
        .set({
          usageCount: sql`${aiProgramPatterns.usageCount} + 1`,
          lastUsedAt: new Date(),
        })
        .where(eq(aiProgramPatterns.id, pattern.id));
      
      const program = generateFromPattern(pattern, request);
      
      return {
        success: true,
        source: 'exact_match',
        matchScore: 1.0,
        patternId: pattern.id,
        program,
        message: 'Generated from exact cached pattern',
      };
    }
    
    if (pattern && matchType === 'similar' && matchScore >= 0.7) {
      console.log(`[LOCAL GENERATOR] ✅ Similar pattern match found (${(matchScore * 100).toFixed(0)}% equipment overlap)`);
      
      // Update usage stats
      await db
        .update(aiProgramPatterns)
        .set({
          usageCount: sql`${aiProgramPatterns.usageCount} + 1`,
          lastUsedAt: new Date(),
        })
        .where(eq(aiProgramPatterns.id, pattern.id));
      
      const program = generateFromPattern(pattern, request);
      
      // Filter out exercises that require unavailable equipment
      for (const session of program.sessions) {
        session.exercises = session.exercises.filter(ex => 
          checkEquipmentAvailable(ex.equipment, request.equipment)
        );
      }
      
      return {
        success: true,
        source: 'similar_match',
        matchScore,
        patternId: pattern.id,
        program,
        message: `Generated from similar pattern (${(matchScore * 100).toFixed(0)}% match)`,
      };
    }
    
    // 2. Try rule-based generation
    console.log('[LOCAL GENERATOR] No pattern match, trying rule-based generation...');
    const ruleBasedProgram = await generateFromRules(request);
    
    if (ruleBasedProgram && ruleBasedProgram.sessions.length >= request.daysPerWeek) {
      console.log('[LOCAL GENERATOR] ✅ Rule-based generation successful');
      
      return {
        success: true,
        source: 'rule_based',
        program: ruleBasedProgram,
        message: 'Generated from exercise selection rules',
      };
    }
    
    // 3. Cannot generate locally
    console.log('[LOCAL GENERATOR] ❌ Cannot generate locally, AI fallback required');
    
    return {
      success: false,
      source: 'failed',
      message: 'Not enough cached data for local generation. AI generation required.',
    };
    
  } catch (error) {
    console.error('[LOCAL GENERATOR] Error:', error);
    return {
      success: false,
      source: 'failed',
      message: `Local generation error: ${error}`,
    };
  }
}

/**
 * Get statistics about local generation capability
 */
export async function getLocalGenerationStats(): Promise<{
  canGenerateLocally: boolean;
  patternCount: number;
  ruleCount: number;
  topGoals: { goal: string; count: number }[];
}> {
  const patterns = await db.select().from(aiProgramPatterns);
  const rules = await db.select().from(exerciseSelectionRules);
  
  // Count patterns by goal
  const goalCounts = new Map<string, number>();
  for (const pattern of patterns) {
    const goal = pattern.trainingGoal;
    goalCounts.set(goal, (goalCounts.get(goal) || 0) + 1);
  }
  
  const topGoals = Array.from(goalCounts.entries())
    .map(([goal, count]) => ({ goal, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    canGenerateLocally: patterns.length >= 1 || rules.length >= 10,
    patternCount: patterns.length,
    ruleCount: rules.length,
    topGoals,
  };
}

export default {
  generateLocalProgram,
  getLocalGenerationStats,
};
