
import * as fs from 'fs';
import * as path from 'path';

const STRINGS_PATH = '/Users/thomassoderberg/.gemini/antigravity/scratch/Test/RepCompanion 2/RepCompanioniOS/Resources/Localizable.xcstrings';
const EXPORT_PATH = path.join(path.dirname(STRINGS_PATH), 'localization_export.csv');

function escapeCsv(value: string | undefined | null): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

async function exportToCsv() {
    try {
        if (!fs.existsSync(STRINGS_PATH)) {
            console.error(`File not found: ${STRINGS_PATH}`);
            process.exit(1);
        }

        const content = fs.readFileSync(STRINGS_PATH, 'utf8');
        const json = JSON.parse(content);
        
        let csvContent = 'Key,English,Swedish,State,Comment\n';
        let count = 0;

        for (const [key, entry] of Object.entries(json.strings)) {
            const e = entry as any;
            
            const english = e.localizations?.en?.stringUnit?.value || '';
            const swedish = e.localizations?.sv?.stringUnit?.value || '';
            const state = e.localizations?.sv?.stringUnit?.state || e.localizations?.en?.stringUnit?.state || '';
            const comment = e.comment || '';

            csvContent += `${escapeCsv(key)},${escapeCsv(english)},${escapeCsv(swedish)},${escapeCsv(state)},${escapeCsv(comment)}\n`;
            count++;
        }

        fs.writeFileSync(EXPORT_PATH, csvContent, 'utf8');
        console.log(`Successfully exported ${count} strings to:`);
        console.log(EXPORT_PATH);

    } catch (e) {
        console.error("Export failed:", e);
    }
}

exportToCsv();
