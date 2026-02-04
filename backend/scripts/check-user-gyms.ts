
import { db } from '../server/db';
import { gyms, users } from '../shared/schema';
import { eq, desc } from 'drizzle-orm';

async function checkUserGyms() {
    console.log('Connecting to DB...');
    // Target specific user from logs
    const userId = "000134.d4586703b7f240d7b8652c9608f6f56b.1127";
    // const user = await db.select().from(users).orderBy(desc(users.createdAt)).limit(1);
    
    // if (!user.length) {
    //     console.log('No users found.');
    //     return;
    // }
    
    // const userId = user[0].id;
    console.log('Checking gyms for user:', userId);
    
    const userGyms = await db.select().from(gyms).where(eq(gyms.userId, userId));
    console.log('Found', userGyms.length, 'gyms');
    userGyms.forEach(g => console.log(`- "${g.name}" (ID: ${g.id}) Created: ${g.createdAt}`));
}

checkUserGyms().catch(console.error);
