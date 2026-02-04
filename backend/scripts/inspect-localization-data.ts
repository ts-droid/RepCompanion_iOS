
import { db } from '../server/db';
import { exercises, equipmentCatalog } from '../shared/schema';
import { eq, ilike } from 'drizzle-orm';

async function checkData() {
    console.log('--- INSPECTING EQUIPMENT CATALOG ---');
    const eqData = await db.select().from(equipmentCatalog);
    eqData.forEach(e => {
        if (['dumbbells', 'barbell', 'adjustable_bench', 'cable', 'kettlebell'].some(k => e.equipmentKey?.includes(k))) {
            console.log(`Key: ${e.equipmentKey}, Name: ${e.name}, NameEn: ${e.nameEn}`);
        }
    });

    console.log('\n--- INSPECTING EXERCISES ---');
    // Check specific exercises visible in the screenshot
    const searchTerms = ['Deadlift', 'Bench Press', 'Swing', 'Step-Up'];
    
    for (const term of searchTerms) {
        const results = await db.select().from(exercises).where(ilike(exercises.name, `%${term}%`)).limit(3);
        results.forEach(ex => {
             console.log(`ID: ${ex.exerciseId}, Name: "${ex.name}", NameEn: "${ex.nameEn}"`);
        });
    }
}

checkData().catch(console.error);
