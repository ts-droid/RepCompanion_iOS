
import 'dotenv/config';
import { db } from "./server/db";
import { gymPrograms, programTemplates, programTemplateExercises, userProfiles } from "./shared-ts/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
    // 1. Get the latest profile to find the user
    // We'll just grab the most recent profile updated/created
    const profiles = await db.select().from(userProfiles).orderBy(desc(userProfiles.updatedAt)).limit(1);
    
    if (profiles.length === 0) {
        console.log("No profiles found.");
        return;
    }
    
    const profile = profiles[0];
    console.log(`Checking user: ${profile.userId} (Profile ID: ${profile.id})`);
    console.log(`Requested Sessions/Week: ${profile.sessionsPerWeek}`);

    // 2. Get the latest active programs (last 3)
    const programs = await db.select()
        .from(gymPrograms)
        .where(eq(gymPrograms.userId, profile.userId))
        .orderBy(desc(gymPrograms.createdAt))
        .limit(3);

    if (programs.length === 0) {
        console.log("No active programs found.");
        return;
    }

    console.log(`\nFound ${programs.length} Programs:`);
    programs.forEach((prog, idx) => {
        const data = prog.programData as any;
        const count = data.weekly_schedule?.length || 0;
        console.log(`${idx+1}. ID: ${prog.id} (${count} sessions) - Created: ${prog.createdAt}`);
    });

    const program = programs[0]; // Use latest for detailed inspection if valid, else iterate?
    // Let's just dump duplicates for ALL recent templates
    
    // 3. Get templates for this user (last 10)
    const matchingTemplates = await db.select()
        .from(programTemplates)
        .where(eq(programTemplates.userId, profile.userId))
        .orderBy(desc(programTemplates.createdAt))
        .limit(10);

    console.log(`\n[DB TEMPLATES] Found ${matchingTemplates.length} recent templates.`);

    // Check them in chronological order
    for (const template of matchingTemplates.reverse()) {
        console.log(`\nTemplate: ${template.templateName} (ID: ${template.id})`);
        
        const exercises = await db.select()
            .from(programTemplateExercises)
            .where(eq(programTemplateExercises.templateId, template.id))
            .orderBy(programTemplateExercises.orderIndex);

        console.log(`Exercise Count: ${exercises.length}`);
        
        // Check for duplicates
        exercises.forEach(ex => {
            console.log(`${ex.orderIndex}. ${ex.exerciseName} [${ex.targetSets}x${ex.targetReps}] (ID: ${ex.id})`);
        });
    }
    
    process.exit(0);
}

main();
