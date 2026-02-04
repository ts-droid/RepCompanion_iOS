
import * as fs from 'fs';

const STRINGS_PATH = '/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanioniOS/Resources/Localizable.xcstrings';

const ENGLISH_TRANSLATIONS: Record<string, string> = {
    // Equipment
    "dumbbells": "Dumbbells",
    "barbell": "Barbell",
    "cable_machine": "Cable Machine",
    "adjustable_bench": "Adjustable Bench",
    "kettlebell": "Kettlebell",
    "kettlebells": "Kettlebells",
    "trap_bar": "Trap Bar",
    "plyo_box": "Plyo Box",
    "pull_up_bar": "Pull-up Bar",
    "smith_machine": "Smith Machine",
    "machine": "Machine",
    "bodyweight": "Bodyweight",
    "band": "Resistance Band",
    "bench": "Bench",
    "rack": "Squat Rack",
    "ez_bar": "EZ Bar",

    // Common Exercises (snake_case -> English Title Case)
    "barbell_deadlift": "Barbell Deadlift",
    "barbell_squat": "Barbell Squat",
    "bench_press": "Bench Press",
    "overhead_press": "Overhead Press",
    "pull_up": "Pull Up",
    "dumbbell_row": "Dumbbell Row",
    "dumbbell_press": "Dumbbell Press",
    "leg_press": "Leg Press",
    "leg_extension": "Leg Extension",
    "leg_curl": "Leg Curl",
    "lat_pulldown": "Lat Pulldown",
    "seated_row": "Seated Row",
    "face_pull": "Face Pull",
    "tricep_pushdown": "Tricep Pushdown",
    "bicep_curl": "Bicep Curl",
    "crunch": "Crunch",
    "plank": "Plank",
    "russian_twist": "Russian Twist",
    "hanging_leg_raise": "Hanging Leg Raise",
    "calf_raise": "Calf Raise"
};

async function fixEquipmentEnglish() {
    try {
        const content = fs.readFileSync(STRINGS_PATH, 'utf8');
        const json = JSON.parse(content);
        let count = 0;

        for (const [key, enText] of Object.entries(ENGLISH_TRANSLATIONS)) {
            // Only act if the key exists (meaning we added it before or it exists in app)
            if (!json.strings[key]) continue;

            const entry = json.strings[key];
            if (!entry.localizations) entry.localizations = {};
            
            // Check if English is missing or is just the raw key (snake_case)
            const currentEn = entry.localizations.en?.stringUnit?.value;
            
            if (!currentEn || currentEn === key) {
                 entry.localizations.en = {
                    "stringUnit": {
                        "state": "translated",
                        "value": enText
                    }
                };
                console.log(`[UPDATE] Set English for "${key}" -> "${enText}"`);
                count++;
            }
        }
        
        fs.writeFileSync(STRINGS_PATH, JSON.stringify(json, null, 2), 'utf8');
        console.log(`Updated ${count} English translations for equipment/exercises.`);

    } catch (e) {
        console.error(e);
    }
}

fixEquipmentEnglish();
