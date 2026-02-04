
import fs from 'fs';

const filePath = 'client/src/pages/AdminDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the first occurrence of <TabsContent value="gyms"
const gymTabStart = content.indexOf('<TabsContent value="gyms"');
if (gymTabStart !== -1) {
  const gymTabNext = content.indexOf('<TabsContent value="gyms"', gymTabStart + 1);
  if (gymTabNext !== -1) {
    // There is a second copy.
    // Let's find the end of the first copy (the next </TabsContent>)
    // Wait, let's just find the whole block from first <TabsContent value="gyms" to last </TabsContent> before </Tabs>
    
    // Actually, I'll just find the duplicated block and remove it carefully.
    // The second copy starts at line 785 in the previous view.
    
    // Let's just find the end of the whole Tabs group.
    const tabsEnd = content.lastIndexOf('</Tabs>');
    
    // I want to keep ONLY one gyms tab. I'll take the better one (the second one) but place it correctly.
  }
}

// SIMPLER: I'll just use a regex to find the duplicated block.
// Each TabsContent is a block.
const blocks = content.split('<TabsContent');
const uniqueBlocks = [];
const seenValues = new Set();

uniqueBlocks.push(blocks[0]); // Initial part before first TabsContent

for (let i = 1; i < blocks.length; i++) {
  const block = '<TabsContent' + blocks[i];
  const valueMatch = block.match(/value="([^"]+)"/);
  if (valueMatch) {
    const value = valueMatch[1];
    if (!seenValues.has(value)) {
      seenValues.add(value);
      uniqueBlocks.push(block);
    }
  } else {
    uniqueBlocks.push(block);
  }
}

content = uniqueBlocks.join('');

fs.writeFileSync(filePath, content);
console.log("Deduplicated TabsContent in AdminDashboard.tsx");
