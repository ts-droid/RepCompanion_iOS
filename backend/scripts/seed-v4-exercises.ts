import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pkg from "pg";
const { Pool } = pkg;
import * as schema from "../shared/schema";
import fs from "fs";
import path from "path";

const dbUrl = "postgresql://postgres:DvDsaHrJfqkDXuoXHLVrTFlnNHLYWySS@trolley.proxy.rlwy.net:29439/railway";
const pool = new Pool({ connectionString: dbUrl });
const db = drizzle(pool, { schema });

const exercisesJsonPath = "/Users/thomassoderberg/.gemini/antigravity/scratch/RepCompanion_server-main/server/data/exercises.json";

async function seed() {
    console.log("🌱 Starting V4 Exercise Seeding...");
    const data = JSON.parse(fs.readFileSync(exercisesJsonPath, "utf-8"));
    
    let inserted = 0;
    let updated = 0;

    for (const ex of data) {
        try {
            // Find existing exercise by name_en or name (fallback)
            const [existing] = await db.select().from(schema.exercises).where(
                sql`${schema.exercises.nameEn} = ${ex.name} OR ${schema.exercises.name} = ${ex.name}`
            );

            if (existing) {
                await db.update(schema.exercises)
                    .set({ exerciseId: ex.id, nameEn: ex.name })
                    .where(sql`${schema.exercises.id} = ${existing.id}`);
                updated++;
            } else {
                await db.insert(schema.exercises).values({
                    exerciseId: ex.id,
                    name: ex.name,
                    nameEn: ex.name,
                    category: ex.category || "General",
                    difficulty: ex.difficulty || "Intermediate",
                    primaryMuscles: [ex.primary_muscle_group || "Full Body"],
                    requiredEquipment: [ex.equipment || "Other"],
                    youtubeUrl: ex.video_url,
                    isCompound: false, // Default
                });
                inserted++;
            }
        } catch (e: any) {
            console.error(`Error with ${ex.name}: ${e.message}`);
        }
    }

    console.log(`✨ Seeding finished. Inserted: ${inserted}, Updated: ${updated}`);
    await pool.end();
}

seed().catch(console.error);
