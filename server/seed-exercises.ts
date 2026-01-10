import { db } from "./db";
import { exercises } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Seed exercises from JSON file into database
 * Maps JSON structure to database schema
 */

interface ExerciseJson {
  id: string;
  name: string;
  primary_muscle_group: string;
  category: string;
  equipment: string;
  difficulty: string;
  video_url: string;
}

// Mapping from English to Swedish exercise names
const nameTranslations: Record<string, string> = {
  // Chest
  "Barbell Bench Press": "Bänkpress med skivstång",
  "Incline Barbell Bench Press": "Bänkpress lutande bänk med skivstång",
  "Decline Barbell Bench Press": "Bänkpress negativ vinkel med skivstång",
  "Flat Dumbbell Press": "Bänkpress med hantlar",
  "Incline Dumbbell Press": "Bänkpress lutande bänk med hantlar",
  "Decline Dumbbell Press": "Bänkpress negativ vinkel med hantlar",
  "Push-Up": "Armhävning",
  "Wide Push-Up": "Bred armhävning",
  "Close-Grip Push-Up": "Smal armhävning",
  "Standing Cable Fly": "Kabelflyes stående",
  "Cable Crossover (High to Low)": "Kabelkryss (högt till lågt)",
  "Cable Crossover (Low to High)": "Kabelkryss (lågt till högt)",
  "Machine Chest Press": "Bröstpress maskin",
  "Pec Deck Fly": "Butterfly maskin",
  
  // Back
  "Conventional Deadlift": "Marklyft",
  "Romanian Deadlift": "Rumänsk marklyft",
  "Sumo Deadlift": "Sumomarklyft",
  "Barbell Bent-Over Row": "Rodd framåtlutad med skivstång",
  "Pendlay Row": "Pendlay-rodd",
  "One-Arm Dumbbell Row": "Enarms hantelrodd",
  "T-Bar Row": "T-bar rodd",
  "Seated Cable Row (Wide Grip)": "Sittande kabelrodd (brett grepp)",
  "Seated Cable Row (Close Grip)": "Sittande kabelrodd (smalt grepp)",
  "Lat Pulldown (Wide Grip)": "Latsdrag (brett grepp)",
  "Lat Pulldown (Close/Neutral Grip)": "Latsdrag (smalt/neutralt grepp)",
  "Pull-Up": "Chins",
  "Chin-Up": "Chins undergrepp",
  "Inverted Row": "Australiensisk chins",
  "Straight-Arm Pulldown": "Raka armar latsdrag",
  "Face Pull": "Face pulls",
  "Machine Row": "Rodd maskin",
  
  // Shoulders
  "Overhead Press": "Axelpress stående",
  "Seated Dumbbell Shoulder Press": "Axelpress sittande med hantlar",
  "Arnold Press": "Arnold press",
  "Lateral Raise": "Sidan lyft",
  "Front Raise": "Framåtlyft",
  "Rear Delt Fly (Dumbbell)": "Bakåtlyft med hantlar",
  "Rear Delt Cable Fly": "Bakåtlyft kabel",
  "Upright Row": "Upprätt rodd",
  "Machine Shoulder Press": "Axelpress maskin",
  "Cable Lateral Raise": "Sidan lyft kabel",
  
  // Biceps
  "Barbell Curl": "Bicepscurl med skivstång",
  "EZ-Bar Curl": "Bicepscurl EZ-stång",
  "Dumbbell Curl": "Bicepscurl med hantlar",
  "Hammer Curl": "Hammer curl",
  "Incline Dumbbell Curl": "Bicepscurl lutande bänk",
  "Preacher Curl": "Preacher curl",
  "Cable Curl": "Bicepscurl kabel",
  "Concentration Curl": "Koncentrationscurl",
  "Cable Hammer Curl (Rope)": "Hammer curl kabel med rep",
  
  // Triceps
  "Close-Grip Bench Press": "Bänkpress smalt grepp",
  "Barbell Skullcrusher": "Skullcrusher skivstång",
  "Dumbbell Skullcrusher": "Skullcrusher hantlar",
  "Overhead Dumbbell Triceps Extension": "Tricepspress över huvudet",
  "Cable Triceps Pushdown (Bar)": "Triceps pushdown kabel (stång)",
  "Cable Triceps Pushdown (Rope)": "Triceps pushdown kabel (rep)",
  "Cable Overhead Triceps Extension (Rope)": "Tricepspress över huvudet kabel",
  "Bench Dip": "Dips bänk",
  "Parallel Bar Dip": "Dips",
  
  // Forearms
  "Barbell Wrist Curl": "Handled curl skivstång",
  "Barbell Reverse Wrist Curl": "Omvänd handled curl",
  "Farmer's Walk": "Farmers walk",
  "Reverse Curl (EZ-Bar)": "Omvänd curl EZ-stång",
  
  // Legs
  "Back Squat": "Knäböj",
  "Front Squat": "Framknäböj",
  "Hack Squat (Machine)": "Hacklyft maskin",
  "Leg Press": "Benpress",
  "Walking Lunge": "Utfallssteg gående",
  "Stationary Lunge": "Utfallssteg stationära",
  "Bulgarian Split Squat": "Bulgariska splitknäböj",
  "Leg Extension": "Benförlängning",
  "Good Morning": "Good morning",
  "Lying Leg Curl": "Bencurl liggande",
  "Seated Leg Curl": "Bencurl sittande",
  "Barbell Hip Thrust": "Höftlyft med skivstång",
  "Glute Bridge": "Höftlyft",
  "Cable Pull-Through": "Kabel pull-through",
  "Step-Up": "Steguppsteg",
  "Cable Glute Kickback": "Kabel glute kickback",
  
  // Calves
  "Standing Calf Raise": "Vadpress stående",
  "Seated Calf Raise": "Vadpress sittande",
  "Calf Press on Leg Press": "Vadpress i benpress",
  
  // Core
  "Plank": "Plankan",
  "Side Plank": "Sidplankan",
  "Crunch": "Crunch",
  "Reverse Crunch": "Omvänd crunch",
  "Hanging Leg Raise": "Benlyft hängande",
  "Lying Leg Raise": "Benlyft liggande",
  "Cable Crunch": "Crunch kabel",
  "Russian Twist": "Rysk twist",
  "Bicycle Crunch": "Cykel crunch",
  "Dead Bug": "Dead bug",
  "Bird Dog": "Bird dog",
  "Ab Wheel Rollout": "Ab wheel rollout",
  
  // Full Body
  "Power Clean": "Power clean",
  "Clean and Jerk": "Clean and jerk",
  "Snatch": "Ryck",
  "Kettlebell Swing": "Kettlebell swing",
  "Thruster": "Thruster",
  "Burpee": "Burpee",
};

// Map equipment names to Swedish
const equipmentMap: Record<string, string> = {
  "Barbell": "Skivstång",
  "Dumbbell": "Hantlar",
  "Cable": "Kabel",
  "Machine": "Maskin",
  "Bodyweight": "Kroppsvikt",
  "Kettlebell": "Kettlebell",
  "Other": "Övrigt",
};

// Map muscle groups to Swedish
const muscleGroupMap: Record<string, string> = {
  "Chest": "Bröst",
  "Back": "Rygg",
  "Shoulders": "Axlar",
  "Biceps": "Biceps",
  "Triceps": "Triceps",
  "Forearms": "Underarmar",
  "Quads": "Quadriceps",
  "Hamstrings": "Bakre lår",
  "Glutes": "Gluteus",
  "Calves": "Vader",
  "Core": "Mage/Core",
  "Full Body": "Helkropp",
};

async function seedExercises() {
  try {
    console.log("🌱 Starting exercise seeding...");
    
    // Read JSON file
    const jsonPath = path.join(__dirname, "data", "exercises.json");
    const jsonContent = fs.readFileSync(jsonPath, "utf-8");
    const exercisesJson: ExerciseJson[] = JSON.parse(jsonContent);
    
    console.log(`📋 Found ${exercisesJson.length} exercises in JSON`);
    
    // Transform and insert each exercise
    let inserted = 0;
    let skipped = 0;
    
    for (const ex of exercisesJson) {
      try {
        const swedishName = nameTranslations[ex.name] || ex.name;
        const equipment = equipmentMap[ex.equipment] || ex.equipment;
        const primaryMuscle = muscleGroupMap[ex.primary_muscle_group] || ex.primary_muscle_group;
        
        // Determine if compound exercise (multi-joint movements)
        const compoundExercises = [
          "Squat", "Deadlift", "Bench Press", "Row", "Press", "Pull-Up", 
          "Chin-Up", "Dip", "Lunge", "Clean", "Snatch", "Thruster"
        ];
        const isCompound = compoundExercises.some(type => ex.name.includes(type));
        
        await db.insert(exercises).values({
          name: swedishName,
          nameEn: ex.name,
          category: ex.category,
          difficulty: ex.difficulty.toLowerCase(),
          primaryMuscles: [primaryMuscle],
          secondaryMuscles: [],
          requiredEquipment: [equipment],
          isCompound,
          youtubeUrl: ex.video_url,
          description: null,
          movementPattern: null,
          instructions: null,
        }).onConflictDoUpdate({
          target: exercises.name,
          set: {
            youtubeUrl: ex.video_url,
            nameEn: ex.name,
          }
        });
        
        inserted++;
        
        if (inserted % 10 === 0) {
          console.log(`✅ Inserted ${inserted}/${exercisesJson.length} exercises`);
        }
      } catch (err: any) {
        if (err.code === '23505') {
          // Unique constraint violation - exercise already exists
          skipped++;
        } else {
          console.error(`❌ Error inserting exercise ${ex.name}:`, err.message);
        }
      }
    }
    
    console.log(`\n✨ Seeding complete!`);
    console.log(`   Inserted: ${inserted} exercises`);
    console.log(`   Skipped: ${skipped} exercises (already exist)`);
    
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Seeding failed:", error.message);
    process.exit(1);
  }
}

seedExercises();
