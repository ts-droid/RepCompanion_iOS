export const equipmentOptions = [
  "Barbell",
  "Dumbbells",
  "Kettlebells",
  "Resistance Bands",
  "Medicine Ball",
  "Bench",
  "Squat Rack",
  "Smith Machine",
  "Cable Machine",
  "Lat Pulldown",
  "Chest Fly Machine",
  "Chest Press Machine",
  "Shoulder Press Machine",
  "Leg Press",
  "Leg Extension",
  "Leg Curl",
  "Hack Squat Machine",
  "Functional Trainer",
  "Pull-up Bar",
  "Treadmill",
  "Stationary Bike",
  "Elliptical",
  "Rowing Machine",
  "Stepmill",
  "Ab Crunch Machine",
  "Ab Roller",
  "Abdominal Bench",
  "Stability Ball",
] as const;

export type EquipmentType = typeof equipmentOptions[number];

export const roboflowToEquipmentMap: Record<string, EquipmentType> = {
  "dumbbell": "Dumbbells",
  "barbell": "Barbell",
  "kettlebells": "Kettlebells",
  "bench": "Bench",
  "smith machine": "Smith Machine",
  "lat pull down machine": "Lat Pulldown",
  "chest fly machine": "Chest Fly Machine",
  "chest press machine": "Chest Press Machine",
  "shoulder press machine": "Shoulder Press Machine",
  "leg press machine": "Leg Press",
  "leg extension machine": "Leg Extension",
  "leg curl machine": "Leg Curl",
  "hack squat machine": "Hack Squat Machine",
  "functional trainer": "Functional Trainer",
  "treadmill": "Treadmill",
  "stationary bike": "Stationary Bike",
  "elliptical": "Elliptical",
  "stepmill": "Stepmill",
  "ab crunch machine": "Ab Crunch Machine",
  "ab roller": "Ab Roller",
  "abdominal bench": "Abdominal Bench",
  "stability ball": "Stability Ball",
};

export function matchEquipmentFromAI(detectedLabel: string): EquipmentType[] {
  const normalizedLabel = detectedLabel.toLowerCase().trim();
  
  const match = roboflowToEquipmentMap[normalizedLabel];
  
  if (match) {
    return Array.isArray(match) ? match : [match];
  }
  
  for (const option of equipmentOptions) {
    if (option.toLowerCase().includes(normalizedLabel) || normalizedLabel.includes(option.toLowerCase())) {
      return [option];
    }
  }
  
  return [];
}

export function parseQRCode(qrData: string): EquipmentType[] {
  try {
    const data = JSON.parse(qrData);
    if (data.equipment && typeof data.equipment === 'string') {
      return matchEquipmentFromAI(data.equipment);
    }
  } catch {
  }
  
  return matchEquipmentFromAI(qrData);
}
