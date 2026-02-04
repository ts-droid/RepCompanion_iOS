
import { db } from '../server/db';
import { exercises } from '../shared/schema';

async function findDuplicates() {
  console.log('Fetching exercises...');
  const all = await db.select().from(exercises);
  console.log(`Found ${all.length} exercises.`);
  
  const byName = new Map<string, any[]>();
  
  all.forEach(ex => {
    const norm = (ex.name || '').toLowerCase().trim();
    const normEn = (ex.nameEn || '').toLowerCase().trim();
    
    if (norm) {
      if (!byName.has(norm)) byName.set(norm, []);
      byName.get(norm)!.push(ex);
    }
    if (normEn && normEn !== norm) {
      if (!byName.has(normEn)) byName.set(normEn, []);
      byName.get(normEn)!.push(ex);
    }
  });

  console.log('\n--- POTENTIAL DUPLICATES BY NAME ---');
  let found = false;
  for (const [name, matches] of byName.entries()) {
    if (matches.length > 1) {
      // De-duplicate the matches by ID in case an exercise matched both Name and NameEn
      const uniqueMatches = Array.from(new Map(matches.map(m => [m.id, m])).values());
      if (uniqueMatches.length > 1) {
          found = true;
          console.log(`\nMatch Group: "${name}"`);
          uniqueMatches.forEach(m => console.log(`  - ID: ${m.id}, Name: ${m.name}, NameEn: ${m.nameEn}, Category: ${m.category}`));
      }
    }
  }
  
  if (!found) {
    console.log('No duplicates found based on name matching.');
  }
}

findDuplicates().catch(console.error);
