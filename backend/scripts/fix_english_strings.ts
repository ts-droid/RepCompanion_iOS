
import * as fs from 'fs';

const STRINGS_PATH = '/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanioniOS/Resources/Localizable.xcstrings';

const TRANSLATIONS: Record<string, string> = {
    // Audit Findings Logic
    "Genomför ditt första pass för att se historik här": "Complete your first session to see history here",
    "Gick inte att hämta analys": "Could not fetch analysis",
    "Godkänn": "Approve",
    "Godkänn övningar & utrustning": "Approve exercises & equipment",
    "Hälsodata": "Health Data",
    "Hälsodata ansluten": "Health Data Connected",
    "Hälsointegration": "Health Integration",
    "Hälsotrender": "Health Trends",
    "Hantera träningspass": "Manage Workouts",
    "Här är en sammanfattning av det du hann med.": "Here is a summary of what you accomplished.",
    "Hitta i närheten": "Find Nearby",
    "Hoppa över": "Skip",
    "Hoppa till nästa övning": "Skip to next exercise",
    "Hur kändes passet? Något att komma ihåg till nästa gång?": "How did the session feel? Something to remember for next time?",
    "Inga övningar": "No exercises",
    "Inga övningar hittades": "No exercises found",
    "Inga personbästa än": "No personal records yet",
    "Inga träningsprogram": "No training programs",
    "Inga väntande övningar": "No pending exercises",
    "Ingen data ännu": "No data yet",
    "Ingen historik än": "No history yet",
    "Ingen träningshistorik än": "No training history yet",
    "Ingen utrustning vald. Detta gym kommer endast att stödja kroppsviktsövningar.": "No equipment selected. This gym will only support bodyweight exercises.",
    "Ingen väntande utrustning": "No pending equipment",
    "Inställningar": "Settings",
    "Ja, baserat på mitt program": "Yes, based on my program",
    "Ja, kör!": "Yes, let's go!",
    "Känner igen utrustning...": "Recognizing equipment...",
    "Laddar övningar...": "Loading exercises...",
    "Lägg till": "Add",
    "Lägg till ditt första gym för att komma igång.": "Add your first gym to get started.",
    "Lägg till övning": "Add Exercise",
    "Logga övningar för att se dina PBs här": "Log exercises to see your PBs here",
    "Logga övningar för att se progression": "Log exercises to see progression",
    "Mål": "Goal",
    "Maximera din träning!": "Maximize your training!",
    "Nästa": "Next",
    "Nej, hoppa över": "No, skip",
    "Nollställ": "Reset",
    "Nollställ räknaren för ditt nuvarande program.": "Reset the counter for your current program.",
    "Övervaka din utveckling över tid": "Monitor your progress over time",
    "Övning %lld av %lld": "Exercise %1$lld of %2$lld",
    "Övningar": "Exercises",
    "Övningskatalog": "Exercise Catalog",
    "Övningsstatistik": "Exercise Statistics",
    "Pågående Pass": "Current Session",
    "Pass %lld/%lld": "Session %1$lld/%2$lld",
    "Passlängd: %lld minuter": "Session length: %lld minutes",
    "Pausa & Stäng": "Pause & Close",
    "Personbästa": "Personal Records",
    "Primära": "Primary",
    "Privata gym sparas endast för dig.": "Private gyms are saved only for you.",
    "Radera allt och börja om?": "Delete everything and start over?",
    "Se dina hälsomätvärden över tid": "See your health metrics over time",
    "Sekundära": "Secondary",
    "Skapa program för gymmet?": "Create program for this gym?",
    "Slutför träningspass": "Finish Workout",
    "Sök gym i närheten": "Search nearby gyms",
    "Sök övning": "Search exercise",
    "Sök övningar...": "Search exercises...",
    "Sök video": "Search video",
    "Sömn (senaste natten)": "Sleep (last night)",
    "Sömn:": "Sleep:",
    "Spara ändringar": "Save Changes",
    "Stäng": "Close",
    "Synka automatiskt träningsdata, steg, sömn och återhämtning från dina hälsoplattformar.": "Automatically sync workout data, steps, sleep and recovery from your health platforms.",
    "Synka hälsodata": "Sync Health Data",
    "Synka med HealthKit för att se data": "Sync with HealthKit to see data",
    "Synka övningskatalog": "Sync Exercise Catalog",
    "Synkar övningskatalog...": "Syncing exercise catalog...",
    "Synkning slutförd": "Sync complete",
    "Ta bort alla program och gym för att börja om helt.": "Delete all programs and gyms to start over completely.",
    "Total återhämtning:": "Total recovery:",
    "Träningsfrekvens": "Training Frequency",
    "Träningshistorik": "Workout History",
    "Träningsmål": "Training Goals",
    "Träningspass:": "Workouts:",
    "Träningsprogram": "Workout Program",
    "Träningspuls": "Workout Heart Rate",
    "Träningsstatistik": "Training Statistics",
    "Uppdatera återstående set?": "Update remaining sets?",
    "Uppvärmning": "Warmup",
    "UTRUSTNING SOM BEHÖVS": "EQUIPMENT NEEDED",
    "Välj annat gym": "Choose another gym",
    "Välj ett gym för att komma igång": "Select a gym to get started",
    "Välj mätvärde": "Select metric",
    "Välj som aktivt gym": "Select as active gym",
    "Välj Tema": "Choose Theme",
    "Välj utrustning": "Select Equipment",
    "Välkommen!": "Welcome!",
    "Väntar": "Waiting",
    "Värde": "Value",
    "Vila innan nästa set": "Rest before next set",
    "Vill du pausa passet för att fortsätta senare, eller avsluta det helt?": "Do you want to pause the session to continue later, or finish it completely?",
    "Vill du skapa ett träningsupplägg för detta gym baserat på ditt nuvarande program? Övningarna anpassas efter tillgänglig utrustning.": "Do you want to create a workout plan for this gym based on your current program? Exercises will be adapted to available equipment.",
    "Vill du tillämpa dessa värden på alla återstående set för denna övning i detta pass?": "Do you want to apply these values to all remaining sets for this exercise in this session?",
    "Kolla din e-post!": "Check your email!",
    "Klar": "Done",
    "Kräver Apple Watch för aktivitet": "Requires Apple Watch for activity",
    "Kräver Apple Watch för HRV": "Requires Apple Watch for HRV",
    "Kräver Apple Watch för kondition": "Requires Apple Watch for cardio",
    "Kräver Apple Watch för träning": "Requires Apple Watch for workout",
    "Kräver Apple Watch för vilopuls": "Requires Apple Watch for resting heart rate",
    "Kunde inte aktivera HealthKit. Kontrollera att appen har behörighet i Inställningar.": "Could not enable HealthKit. Please check permissions in Settings.",
    "Kunde inte aktivera notifikationer. Kontrollera att appen har behörighet i Inställningar.": "Could not enable notifications. Please check permissions in Settings.",
    "Känner igen utrustning...": "Recognizing equipment...",
    "Laddar övningar...": "Loading exercises...",
    "Lat Pulldown": "Lat Pulldown"
};

async function fixEnglish() {
    try {
        const content = fs.readFileSync(STRINGS_PATH, 'utf8');
        const json = JSON.parse(content);
        let count = 0;

        for (const [key, enText] of Object.entries(TRANSLATIONS)) {
            if (!json.strings[key]) {
                console.log(`[SKIP] Key not found in file: "${key}"`);
                continue;
            }

            const entry = json.strings[key];
            if (!entry.localizations) entry.localizations = {};
            
            const currentEn = entry.localizations.en?.stringUnit?.value;
            
            // Debug specific key
            if (key.startsWith("Kunde inte aktivera HealthKit")) {
                 console.log(`[DEBUG] Key: "${key}" | Current EN: "${currentEn}" | Target: "${enText}"`);
                 console.log(`[DEBUG] Match? ${currentEn === key}`);
            }

            if (!currentEn || currentEn === key) {
                 entry.localizations.en = {
                    "stringUnit": {
                        "state": "translated",
                        "value": enText
                    }
                };
                console.log(`[UPDATE] Fixed: "${key}" -> "${enText}"`);
                count++;
            }
        }
        
        fs.writeFileSync(STRINGS_PATH, JSON.stringify(json, null, 2), 'utf8');
        console.log(`Updated ${count} English translations.`);

    } catch (e) {
        console.error(e);
    }
}

fixEnglish();
