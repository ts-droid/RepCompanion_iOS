
import { db } from '../server/db';
import { gyms, users } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

async function cleanupGyms() {
    console.log('Cleaning up duplicate "Mitt Gym" entries...');
    
    // Target specific user from logs
    const userId = "000134.d4586703b7f240d7b8652c9608f6f56b.1127";
    
    const userGyms = await db.select().from(gyms).where(eq(gyms.userId, userId));
    const mittGyms = userGyms.filter(g => g.name === "Mitt Gym");
    
    console.log(`Found ${mittGyms.length} "Mitt Gym" entries.`);
    
    if (mittGyms.length <= 1) {
        console.log('No duplicates to clean up.');
        return;
    }
    
    // Keep the oldest one? Or the one with content?
    // Let's assume we keep the oldest one for stability, 
    // OR we could try to see which one has equipment... but they might all have it.
    
    // Sort by creation date ascending (keep [0])
    mittGyms.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    const keep = mittGyms[0];
    const duplicates = mittGyms.slice(1);
    
    console.log(`Keeping: ${keep.id} (Created: ${keep.createdAt})`);
    
    for (const dup of duplicates) {
        console.log(`Deleting: ${dup.id} (Created: ${dup.createdAt})`);
        await db.delete(gyms).where(eq(gyms.id, dup.id));
    }
    
    console.log('✅ Cleanup complete.');
}

cleanupGyms().catch(console.error);
