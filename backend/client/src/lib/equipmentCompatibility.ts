import type { UserEquipment } from "@shared/schema";

export interface MissingEquipmentExercise {
  exerciseTitle: string;
  exerciseKey: string;
  requiredEquipment: string[];
  muscleGroups: string[];
  sessionName?: string;
  phaseIndex?: number;
  sessionIndex?: number;
  exerciseIndex?: number;
}

function normalizeEquipmentName(name: string): string {
  const normalized = name.toLowerCase().trim();
  
  const singularMap: Record<string, string> = {
    'hantlar': 'hantel',
    'kettlebells': 'kettlebell',
    'resistance bands': 'resistance band',
  };

  return singularMap[normalized] || normalized;
}

function isBodyweightOrNone(equipmentName: string): boolean {
  const normalized = equipmentName.toLowerCase().trim();
  const bodyweightAliases = ['bodyweight', 'kroppsvikt', 'egen kropp', 'none', 'ingen', ''];
  return bodyweightAliases.includes(normalized);
}

export function detectMissingEquipment(
  aiProgramData: any,
  availableEquipment: UserEquipment[]
): MissingEquipmentExercise[] {
  if (!aiProgramData || !aiProgramData.phases) {
    return [];
  }

  const availableEquipmentNames = new Set(
    availableEquipment.map(e => normalizeEquipmentName(e.equipmentName))
  );

  const missingEquipmentExercises: MissingEquipmentExercise[] = [];

  aiProgramData.phases.forEach((phase: any, phaseIndex: number) => {
    if (!phase.sessions) return;

    phase.sessions.forEach((session: any, sessionIndex: number) => {
      if (!session.exercises) return;

      session.exercises.forEach((exercise: any, exerciseIndex: number) => {
        const requiredEquipment = exercise.equipment || [];
        
        if (requiredEquipment.length === 0) {
          return;
        }

        const missingEquipment = requiredEquipment.filter((eq: string) => {
          if (isBodyweightOrNone(eq)) {
            return false;
          }
          const normalized = normalizeEquipmentName(eq);
          return !availableEquipmentNames.has(normalized);
        });

        if (missingEquipment.length > 0) {
          missingEquipmentExercises.push({
            exerciseTitle: exercise.title || exercise.name || "Okänd övning",
            exerciseKey: exercise.key || `exercise-${phaseIndex}-${sessionIndex}-${exerciseIndex}`,
            requiredEquipment: missingEquipment,
            muscleGroups: exercise.muscleGroups || [],
            sessionName: session.name,
            phaseIndex,
            sessionIndex,
            exerciseIndex,
          });
        }
      });
    });
  });

  return missingEquipmentExercises;
}
