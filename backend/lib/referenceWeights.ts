export const REFERENCE_WEIGHTS: Record<string, number> = {
  "Bänkpress": 60,
  "Bench Press": 60,
  "Marklyft": 80,
  "Deadlift": 80,
  "Squat": 70,
  "Knäböj": 70,
  "Axelpress": 40,
  "Overhead Press": 40,
  "Military Press": 40,
  "Latsdrag": 50,
  "Lat Pulldown": 50,
  "Pull-up": 0,
  "Chins": 0,
  "Pullups": 0,
  "Rodd": 50,
  "Barbell Row": 50,
  "Bent Over Row": 50,
  "Biceps Curl": 20,
  "Bicepscurl": 20,
  "Hammer Curl": 20,
  "Hammarcurl": 20,
  "Triceps Extension": 25,
  "Tricepspress": 25,
  "Skullcrusher": 25,
  "Leg Press": 100,
  "Benpress": 100,
  "Leg Curl": 30,
  "Bencurl": 30,
  "Leg Extension": 35,
  "Benextension": 35,
  "Cable Fly": 15,
  "Kabelflyes": 15,
  "Face Pull": 20,
  "Facepull": 20,
  "Lateral Raise": 10,
  "Sidohäv": 10,
  "Front Raise": 12,
  "Framhäv": 12,
  "Shrugs": 40,
  "Axellyft": 40,
  "Hip Thrust": 80,
  "Höftlyft": 80,
  "Romanian Deadlift": 60,
  "RDL": 60,
  "Rumänsk Marklyft": 60,
  "Sumo Deadlift": 70,
  "Sumo Marklyft": 70,
  "Incline Bench": 50,
  "Snedpress": 50,
  "Decline Bench": 55,
  "Negativ Bänk": 55,
  "Dips": 0,
  "Dips (Assisted)": -20,
  "Cable Row": 45,
  "Kabelrodd": 45,
  "T-Bar Row": 50,
  "T-Rodd": 50,
  "Chest Press": 55,
  "Bröstpress": 55,
  "Shoulder Press Machine": 45,
  "Axelpressmaskin": 45,
  "Calf Raise": 60,
  "Vadpress": 60,
  "Seated Calf Raise": 40,
  "Sittande Vadpress": 40,
  "Preacher Curl": 18,
  "Predikstolscurl": 18,
  "Cable Curl": 20,
  "Kabelcurl": 20,
  "Rope Pushdown": 25,
  "Reppress": 25,
  "Overhead Triceps": 20,
  "Överhuvud Triceps": 20,
};

export function getReferenceWeight(exerciseName: string): number | null {
  const normalizedName = exerciseName.trim();
  
  if (REFERENCE_WEIGHTS[normalizedName] !== undefined) {
    return REFERENCE_WEIGHTS[normalizedName];
  }
  
  const lowerName = normalizedName.toLowerCase();
  for (const [key, value] of Object.entries(REFERENCE_WEIGHTS)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  
  return null;
}
