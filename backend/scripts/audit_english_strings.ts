
import * as fs from 'fs';

const STRINGS_PATH = '/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanioniOS/Resources/Localizable.xcstrings';

async function auditEnglish() {
    try {
        const content = fs.readFileSync(STRINGS_PATH, 'utf8');
        const json = JSON.parse(content);
        
        let issuesFound = 0;
        console.log("--- AUDITING ENGLISH LOCALIZATION ---");

        for (const [key, entry] of Object.entries(json.strings)) {
            const enVal = (entry as any).localizations?.en?.stringUnit?.value;
            
            if (enVal) {
                // Check for Swedish characters
                if (/[åäöÅÄÖ]/.test(enVal)) {
                    console.log(`[SWEDISH CHARS] Key: "${key}" -> En: "${enVal}"`);
                    issuesFound++;
                }
                
                // Check for common Swedish words (false positives possible, but good for spotting)
                const swedishWords = ['hantlar', 'skivstång', 'pass', 'övning', 'vila', 'vecka', 'dag'];
                const lowerVal = enVal.toLowerCase();
                for (const word of swedishWords) {
                    // distinct word match
                    if (new RegExp(`\\b${word}\\b`).test(lowerVal)) {
                         console.log(`[SWEDISH WORD] Key: "${key}" -> En: "${enVal}" (Matched: ${word})`);
                         issuesFound++;
                    }
                }
            } else {
                // English missing - implied to be Key. 
                // If Key is Swedish, then English is Swedish.
                if (/[åäöÅÄÖ]/.test(key)) {
                    console.log(`[MISSING EN, KEY IS SWEDISH] Key: "${key}"`);
                    issuesFound++;
                }
            }
        }

        console.log(`\nAudit complete. Found ${issuesFound} potential issues.`);

    } catch (e) {
        console.error(e);
    }
}

auditEnglish();
