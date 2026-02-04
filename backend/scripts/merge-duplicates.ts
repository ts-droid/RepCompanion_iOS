
import { db } from '../server/db';
import { 
  exercises, 
  exerciseAliases, 
  exerciseLogs, 
  exerciseStats, 
  programTemplateExercises 
} from '../shared/schema';
import { eq, or, and, sql } from 'drizzle-orm';

async function mergeExercises(targetId: string, sourceId: string) {
  console.log(`\nMerging Source(${sourceId}) into Target(${targetId})...`);

  // 1. Get both exercises
  const [target] = await db.select().from(exercises).where(eq(exercises.id, targetId));
  const [source] = await db.select().from(exercises).where(eq(exercises.id, sourceId));

  if (!target || !source) {
    console.error('Master or Source exercise not found!');
    return;
  }

  const targetKey = target.exerciseId || target.id;
  const sourceKey = source.exerciseId || source.id;

  console.log(`Target: "${target.name}" (${targetKey})`);
  console.log(`Source: "${source.name}" (${sourceKey})`);

  // 2. Update logs
  console.log('Migrating logs...');
  await db.update(exerciseLogs)
    .set({ 
      exerciseKey: targetKey,
      exerciseTitle: target.nameEn || target.name // Keep English in logs if possible
    })
    .where(eq(exerciseLogs.exerciseKey, sourceKey));

  // 3. Update stats (more complex due to unique constraint per user)
  console.log('Migrating stats...');
  const sourceStats = await db.select().from(exerciseStats).where(eq(exerciseStats.exerciseKey, sourceKey));
  for (const stat of sourceStats) {
      // Check if target stat exists for this user
      const [existingTargetStat] = await db.select()
        .from(exerciseStats)
        .where(and(eq(exerciseStats.userId, stat.userId), eq(exerciseStats.exerciseKey, targetKey)));

      if (existingTargetStat) {
          // Merge logic: take max of weights, sum volumes etc
          await db.update(exerciseStats)
            .set({
                maxWeight: Math.max(existingTargetStat.maxWeight || 0, stat.maxWeight || 0),
                totalVolume: (existingTargetStat.totalVolume || 0) + (stat.totalVolume || 0),
                totalSets: (existingTargetStat.totalSets || 0) + (stat.totalSets || 0),
                totalSessions: (existingTargetStat.totalSessions || 0) + (stat.totalSessions || 0),
                updatedAt: new Date()
            })
            .where(eq(exerciseStats.id, existingTargetStat.id));
          
          // Delete source stat
          await db.delete(exerciseStats).where(eq(exerciseStats.id, stat.id));
      } else {
          // Just update the key
          await db.update(exerciseStats)
            .set({ exerciseKey: targetKey, exerciseName: target.name })
            .where(eq(exerciseStats.id, stat.id));
      }
  }

  // 4. Update templates
  console.log('Migrating templates...');
  await db.update(programTemplateExercises)
    .set({ 
        exerciseKey: targetKey,
        exerciseName: target.name // Use target's Swedish name
    })
    .where(eq(programTemplateExercises.exerciseKey, sourceKey));

  // 5. Update aliases
  console.log('Migrating aliases...');
  await db.update(exerciseAliases)
    .set({ exerciseId: targetKey })
    .where(eq(exerciseAliases.exerciseId, sourceKey));

  // 6. Add source name as a new alias for target
  const sourceNameAlias = source.name.trim();
  const sourceNameAliasNorm = sourceNameAlias.toLowerCase().trim();
  
  const [existingAlias] = await db.select()
    .from(exerciseAliases)
    .where(eq(exerciseAliases.aliasNorm, sourceNameAliasNorm));

  if (!existingAlias) {
      await db.insert(exerciseAliases).values({
          exerciseId: targetKey,
          alias: sourceNameAlias,
          aliasNorm: sourceNameAliasNorm,
          lang: 'sv',
          source: 'merge'
      });
  }

  // 7. Delete source exercise BEFORE renaming target to avoid unique constraint collision
  console.log('Deleting source exercise...');
  await db.delete(exercises).where(eq(exercises.id, sourceId));

  // 8. Update target name if source name is shorter and target name is Swedish
  if (source.name.length < target.name.length && target.name !== target.nameEn) {
      console.log(`Updating target name to shorter version: "${source.name}"`);
      await db.update(exercises)
        .set({ name: source.name })
        .where(eq(exercises.id, target.id));
  }
  
  console.log('✅ Merge complete.');
}

async function runPlan() {
  // Plan based on found duplicates (RE-RUN for failed ones)
  const plan = [
    // format: { target: 'master_id', source: 'to_be_deleted_id' }
    
    // Face pulls vs Face pull
    { target: 'f57c35b4-5ee2-4c1e-898d-bd0920f7dabc', source: '39db9616-8304-4252-8458-8417dfac3d51' },
    
    // Cykel crunch / Bencykling
    { target: 'fe884bc1-66be-45ca-9a1f-622b80d9f33a', source: '15f50641-cbba-4556-a797-2578f180e26c' },
  ];

  for (const item of plan) {
    try {
      await mergeExercises(item.target, item.source);
    } catch (err) {
      console.error(`Failed to merge ${item.source} -> ${item.target}:`, err);
    }
  }
}

runPlan().catch(console.error);
