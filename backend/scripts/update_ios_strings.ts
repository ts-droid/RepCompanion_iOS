
import * as fs from 'fs';
import * as path from 'path';

const STRINGS_PATH = '/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanioniOS/Resources/Localizable.xcstrings';

const NEW_TRANSLATIONS: Record<string, string> = {
    // Equipment
    "dumbbells": "Hantlar",
    "barbell": "Skivstång",
    "cable_machine": "Kabelmaskin",
    "adjustable_bench": "Justerbar Bänk",
    "kettlebell": "Kettlebell",
    "kettlebells": "Kettlebells",
    "trap_bar": "Trap Bar",
    "plyo_box": "Plyo Box",
    "pull_up_bar": "Chinsräcke",
    "smith_machine": "Smithmaskin",
    "machine": "Maskin",
    "bodyweight": "Kroppsvikt",
    "band": "Gummiband",
    "bench": "Träningsbänk",
    "rack": "Skivstångsställning",
    "ez_bar": "EZ-stång",

    // Common Exercises
    "barbell_deadlift": "Marklyft",
    "barbell_squat": "Knäböj",
    "bench_press": "Bänkpress",
    "overhead_press": "Militärpress",
    "pull_up": "Chins",
    "dumbbell_row": "Hantelrodd",
    "dumbbell_press": "Hantelpress",
    "leg_press": "Benpress",
    "leg_extension": "Benspark",
    "leg_curl": "Lårcurl",
    "lat_pulldown": "Latsdrag",
    "seated_row": "Sittande Rodd",
    "face_pull": "Face Pulls",
    "tricep_pushdown": "Triceps Pushdown",
    "bicep_curl": "Bicepscurl",
    "crunch": "Crunches",
    "plank": "Plankan",
    "russian_twist": "Russian Twist",
    "hanging_leg_raise": "Hängande Benlyft",
    "calf_raise": "Vadpress"
};

async function updateStrings() {
    try {
        const content = fs.readFileSync(STRINGS_PATH, 'utf8');
        const json = JSON.parse(content);

        let addedCount = 0;
        let updatedCount = 0;

        for (const [key, value] of Object.entries(NEW_TRANSLATIONS)) {
            if (!json.strings[key]) {
                // Key doesn't exist, create it
                json.strings[key] = {
                    "extractionState": "manual",
                    "localizations": {
                        "sv": {
                            "stringUnit": {
                                "state": "translated",
                                "value": value
                            }
                        }
                    }
                };
                addedCount++;
            } else {
                // Key exists, check/update Swedish translation
                if (!json.strings[key].localizations) {
                    json.strings[key].localizations = {};
                }
                
                if (!json.strings[key].localizations.sv) {
                     json.strings[key].localizations.sv = {
                        "stringUnit": {
                            "state": "translated",
                            "value": value
                        }
                    };
                    updatedCount++;
                }
            }
        }

        fs.writeFileSync(STRINGS_PATH, JSON.stringify(json, null, 2), 'utf8');
        console.log(`Successfully updated Localizable.xcstrings`);
        console.log(`Added: ${addedCount} new keys`);
        console.log(`Updated: ${updatedCount} existing keys`);

    } catch (error) {
        console.error("Error updating strings:", error);
        process.exit(1);
    }
}

updateStrings();
