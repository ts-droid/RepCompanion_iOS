
import fs from 'fs';

const filePath = 'server/storage.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Regex to remove lines like: const { ... } = await import("@shared/schema");
// Handle multiple variables and newlines if they exist (though usually they don't in my grep output)
// We also want to handle indentation.
content = content.replace(/^[ \t]*const \{ [^}]+ \} = await import\("@shared\/schema"\);?\n?/gm, '');

fs.writeFileSync(filePath, content);
console.log("Cleaned up storage.ts dynamic imports");
