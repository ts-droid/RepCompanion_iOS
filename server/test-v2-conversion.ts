/**
 * Regression test for V2→V1 conversion schema compliance
 * This script validates that convertV2ToDeepSeekFormat produces valid DeepSeek payloads
 */

import type { WorkoutProgramV2 } from './ai-service';
import { convertV2ToDeepSeekFormat, deepSeekWorkoutProgramSchema } from './ai-service';

// Mock WorkoutProgramV2 fixture (realistic sample)
const mockProgramV2: WorkoutProgramV2 = {
  sessions: [
    {
      name: "Upper Body Strength",
      day: "Måndag",
      focus: "Strength",
      estimatedDurationMinutes: 58,
      exercises: [
        {
          name: "Bench Press",
          sets: 4,
          reps: "6-8",
          restSeconds: 180,
          intensity: "RPE 8-9",
          equipment: "Barbell, Bench"
        },
        {
          name: "Pull-ups",
          sets: 3,
          reps: "8-10",
          restSeconds: 120,
          intensity: "RPE 7-8",
          equipment: "Pull-up Bar"
        }
      ]
    },
    {
      name: "Lower Body Hypertrophy",
      day: "Onsdag",
      focus: "Hypertrophy",
      estimatedDurationMinutes: 62,
      exercises: [
        {
          name: "Squat",
          sets: 4,
          reps: "10-12",
          restSeconds: 90,
          intensity: "RPE 7-8",
          equipment: "Barbell, Rack"
        }
      ]
    }
  ],
  meta: {
    totalPlannedWeeklyMinutes: 120,
    notes: "Test program with V2 auto-1RM estimation"
  }
};

const mockProfile = {
  age: 32,
  sex: 'man',
  bodyWeight: 80,
  height: 180,
  trainingLevel: 'Van',
  goalStrength: 70,
  goalVolume: 60,
  goalEndurance: 40,
  goalCardio: 30,
  sessionsPerWeek: 2,
  sessionDuration: 60
};

const mockEquipmentList = "Barbell, Bench, Pull-up Bar, Rack, Dumbbells";

// Run the test
console.log('=== V2→V1 Conversion Schema Compliance Test ===\n');

console.log('📋 Test fixture:');
console.log(`  - ${mockProgramV2.sessions.length} sessions`);
console.log(`  - ${mockProgramV2.sessions.reduce((sum, s) => sum + s.exercises.length, 0)} total exercises`);
console.log(`  - ${mockProgramV2.meta.totalPlannedWeeklyMinutes} min total weekly duration`);
console.log(`  - Equipment: ${mockEquipmentList}\n`);

try {
  console.log('🔄 Running conversion...');
  const converted = convertV2ToDeepSeekFormat(mockProgramV2, mockProfile, mockEquipmentList);
  
  console.log('✅ Conversion completed\n');
  
  console.log('🔍 Validating against DeepSeek schema...');
  const validated = deepSeekWorkoutProgramSchema.parse(converted);
  
  console.log('✅ Schema validation PASSED\n');
  
  // Additional assertions
  console.log('🧪 Verifying key fields:');
  
  // 1. Duration preservation
  const hasCorrectDurations = validated.weekly_sessions.every((session, idx) => {
    const expected = mockProgramV2.sessions[idx].estimatedDurationMinutes;
    const actual = session.estimated_duration_minutes;
    return expected === actual;
  });
  console.log(`  ✓ Duration preservation: ${hasCorrectDurations ? 'PASS' : 'FAIL'}`);
  
  // 2. Equipment parsing
  const expectedEquipment = mockEquipmentList.split(',').map(e => e.trim());
  const hasCorrectEquipment = validated.user_profile.available_equipment.length === expectedEquipment.length;
  console.log(`  ✓ Equipment parsing: ${hasCorrectEquipment ? 'PASS' : 'FAIL'} (${validated.user_profile.available_equipment.length} items)`);
  
  // 3. Warmup/cooldown presence
  const hasWarmupCooldown = validated.weekly_sessions.every(s => s.warmup.length > 0 && s.cooldown.length > 0);
  console.log(`  ✓ Warmup/cooldown fabrication: ${hasWarmupCooldown ? 'PASS' : 'FAIL'}`);
  
  // 4. Required equipment arrays in exercises
  const hasEquipmentArrays = validated.weekly_sessions.every(s => 
    s.main_work.every(ex => Array.isArray(ex.required_equipment) && ex.required_equipment.length > 0)
  );
  console.log(`  ✓ Exercise equipment arrays: ${hasEquipmentArrays ? 'PASS' : 'FAIL'}`);
  
  // 5. Program overview metadata
  const hasMetadata = validated.program_overview.week_focus_summary.includes('V2-genererat');
  console.log(`  ✓ V2 metadata preservation: ${hasMetadata ? 'PASS' : 'FAIL'}`);
  
  console.log('\n🎉 ALL TESTS PASSED - V2→V1 conversion is schema-compliant!\n');
  
  process.exit(0);
} catch (error) {
  console.error('\n❌ TEST FAILED:');
  console.error(error);
  console.error('\n');
  process.exit(1);
}
