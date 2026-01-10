/**
 * Weight calculation utilities using 1RM (One-Rep Max) data
 * 
 * Based on the Epley formula for calculating working weight from 1RM:
 * Weight = 1RM / (1 + reps/30)
 * 
 * This is used to suggest weights for exercises during workout sessions.
 */

export interface WeightCalculationInput {
  oneRM: number;         // One-rep max for the exercise
  targetReps: number;    // Target number of reps
  rir?: number;          // Reps in reserve (default: 2)
}

/**
 * Calculate suggested weight based on 1RM and target reps
 * 
 * @param oneRM - One-rep max for the exercise in kg
 * @param targetReps - Target number of reps to perform
 * @param rir - Reps in reserve (how many reps left before failure). Default is 2.
 * @returns Suggested weight rounded to nearest 2.5kg
 * 
 * @example
 * // If 1RM bench press is 100kg and target is 8 reps with 2 RIR:
 * calculateWeight(100, 8, 2) // Returns 75kg (rounded)
 */
export function calculateWeight(oneRM: number, targetReps: number, rir: number = 2): number {
  if (oneRM <= 0 || targetReps <= 0) return 0;
  
  // Total reps = target reps + reps in reserve
  const totalReps = targetReps + rir;
  
  // Epley formula: Weight = 1RM / (1 + totalReps/30)
  const calculatedWeight = oneRM / (1 + totalReps / 30);
  
  // Round to nearest 2.5kg (standard plate increment)
  return Math.round(calculatedWeight / 2.5) * 2.5;
}

/**
 * Calculate weight as percentage of 1RM
 * 
 * @param oneRM - One-rep max for the exercise in kg
 * @param percentage - Percentage of 1RM (e.g., 75 for 75%)
 * @returns Weight rounded to nearest 2.5kg
 * 
 * @example
 * calculateWeightFromPercentage(100, 75) // Returns 75kg
 */
export function calculateWeightFromPercentage(oneRM: number, percentage: number): number {
  if (oneRM <= 0 || percentage <= 0) return 0;
  
  const calculatedWeight = (oneRM * percentage) / 100;
  return Math.round(calculatedWeight / 2.5) * 2.5;
}

/**
 * Get weight suggestion with description based on week in program
 * 
 * Week 1 typically uses lighter weight (more RIR)
 * Week 2+ progressively increases intensity (less RIR)
 * 
 * @param oneRM - One-rep max for the exercise in kg
 * @param targetReps - Target number of reps
 * @param week - Week number in program (1, 2, 3, etc.)
 * @returns Object with weight and description
 */
export function getWeightSuggestion(
  oneRM: number, 
  targetReps: number, 
  week: number = 1
): { weight: number; description: string } {
  if (oneRM <= 0) {
    return { weight: 0, description: "Ange ditt 1RM-värde för viktförslag" };
  }

  // Adjust RIR based on week for progressive overload
  const rir = week === 1 ? 3 : week === 2 ? 2 : 1;
  const weight = calculateWeight(oneRM, targetReps, rir);
  
  const rirText = rir === 1 ? "1 rep kvar" : `${rir} reps kvar`;
  
  return {
    weight,
    description: `Vecka ${week}: ${weight}kg (${rirText})`
  };
}

/**
 * Map exercise key to corresponding 1RM field name
 * 
 * This helps match exercises to their stored 1RM values in the user profile
 */
export type OneRMExerciseKey = 'bench' | 'ohp' | 'deadlift' | 'squat' | 'latpull';

export interface OneRMProfile {
  bench: number;      // Bench press 1RM
  ohp: number;        // Overhead press 1RM
  deadlift: number;   // Deadlift 1RM
  squat: number;      // Squat 1RM
  latpull: number;    // Lat pulldown 1RM
}

/**
 * Estimate 1RM from a given weight and reps performed
 * Useful for users who don't know their 1RM but have completed sets
 * 
 * @param weight - Weight lifted in kg
 * @param reps - Number of reps performed
 * @returns Estimated 1RM rounded to nearest 2.5kg
 * 
 * @example
 * // If user did 80kg for 5 reps:
 * estimate1RM(80, 5) // Returns ~92.5kg
 */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  
  // Epley formula reversed: 1RM = weight × (1 + reps/30)
  const estimated1RM = weight * (1 + reps / 30);
  
  return Math.round(estimated1RM / 2.5) * 2.5;
}

/**
 * Get weight range for a given number of reps
 * Returns min/max weights based on conservative and aggressive RIR
 * 
 * @param oneRM - One-rep max for the exercise in kg
 * @param targetReps - Target number of reps
 * @returns Object with min (conservative) and max (aggressive) weights
 */
export function getWeightRange(oneRM: number, targetReps: number): { min: number; max: number } {
  const conservative = calculateWeight(oneRM, targetReps, 3); // More RIR = lighter
  const aggressive = calculateWeight(oneRM, targetReps, 1);   // Less RIR = heavier
  
  return { min: conservative, max: aggressive };
}
