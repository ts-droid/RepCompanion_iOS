
/**
 * Helper to get reference/starting weights for exercises
 * Used when AI doesn't provide a specific weight
 */

const REFERENCE_WEIGHTS: Record<string, number> = {
  // Barbell compounds
  "Squat": 20,
  "Deadlift": 40,
  "Bench Press": 20,
  "Overhead Press": 20,
  "Barbell Row": 20,
  "Romanian Deadlift": 20,
  "Front Squat": 20,
  "Incline Bench Press": 20,
  
  // Dumbbell exercises (per hand)
  "Dumbbell Press": 10,
  "Dumbbell Row": 12,
  "Dumbbell Curls": 8,
  "Lateral Raises": 4,
  "Lunges": 8,
  
  // Bodyweight (0 means bodyweight)
  "Pull Up": 0,
  "Chin Up": 0,
  "Dip": 0,
  "Push Up": 0,
  
  // Machine
  "Lat Pulldown": 30,
  "Seated Row": 30,
  "Leg Press": 50,
  "Leg Extension": 20,
  "Leg Curl": 20,
  "Face Pull": 15,
  "Kettlebell Swing": 16,
  "Goblet Squat": 12
};

export function getReferenceWeight(exerciseName: string): number {
  // Normalize name
  const normalized = exerciseName.toLowerCase();
  
  // Try exact match
  for (const [key, weight] of Object.entries(REFERENCE_WEIGHTS)) {
    if (normalized.includes(key.toLowerCase())) {
      return weight;
    }
  }
  
  // Default weights based on keywords
  if (normalized.includes("dumbbell") || normalized.includes("hantel")) return 10;
  if (normalized.includes("barbell") || normalized.includes("stång")) return 20;
  if (normalized.includes("kettlebell")) return 12;
  if (normalized.includes("machine") || normalized.includes("maskin") || normalized.includes("cable")) return 25;
  
  // Default fallback
  return 15;
}
