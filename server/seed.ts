import { db } from "./db";
import { exercises, equipmentCatalog } from "@shared/schema";

export async function seedExercises() {
  console.log("🌱 Seeding exercises...");
  
  const exerciseData = [
    // BRÖST
    {
      name: "Bänkpress",
      nameEn: "Barbell Bench Press",
      description: "Klassisk bröstövning med skivstång på bänk",
      category: "Bröst",
      difficulty: "Mellannivå",
      primaryMuscles: ["Bröst", "Främre deltoider"],
      secondaryMuscles: ["Triceps"],
      requiredEquipment: ["Skivstång", "Bänk"],
      movementPattern: "Push",
      isCompound: true,
    },
    {
      name: "Hantelpress",
      nameEn: "Dumbbell Bench Press",
      description: "Bröstpress med hantlar för ökad rörelsebana",
      category: "Bröst",
      difficulty: "Mellannivå",
      primaryMuscles: ["Bröst"],
      secondaryMuscles: ["Främre deltoider", "Triceps"],
      requiredEquipment: ["Hantlar", "Bänk"],
      movementPattern: "Push",
      isCompound: true,
    },
    {
      name: "Incline Bänkpress",
      nameEn: "Incline Barbell Bench Press",
      description: "Bänkpress med lutning för övre bröst",
      category: "Bröst",
      difficulty: "Mellannivå",
      primaryMuscles: ["Övre bröst", "Främre deltoider"],
      secondaryMuscles: ["Triceps"],
      requiredEquipment: ["Skivstång", "Justerbar bänk"],
      movementPattern: "Push",
      isCompound: true,
    },
    {
      name: "Dips",
      nameEn: "Chest Dips",
      description: "Kroppsviktsövning för bröst och triceps",
      category: "Bröst",
      difficulty: "Avancerad",
      primaryMuscles: ["Nedre bröst", "Triceps"],
      secondaryMuscles: ["Främre deltoider"],
      requiredEquipment: ["Dip-station"],
      movementPattern: "Push",
      isCompound: true,
    },
    {
      name: "Kabelflyes",
      nameEn: "Cable Flyes",
      description: "Isoleringsövning för bröst med kablar",
      category: "Bröst",
      difficulty: "Nybörjare",
      primaryMuscles: ["Bröst"],
      secondaryMuscles: [],
      requiredEquipment: ["Kabelmaskin"],
      movementPattern: "Isolation",
      isCompound: false,
    },

    // RYGG
    {
      name: "Marklyft",
      nameEn: "Conventional Deadlift",
      description: "Komplett kroppsstyrka, fokus på rygg och lår",
      category: "Rygg",
      difficulty: "Avancerad",
      primaryMuscles: ["Nedre rygg", "Baksida lår", "Gluteus"],
      secondaryMuscles: ["Överarmsmuskler", "Core"],
      requiredEquipment: ["Skivstång"],
      movementPattern: "Pull",
      isCompound: true,
    },
    {
      name: "Rodd med skivstång",
      nameEn: "Barbell Row",
      description: "Horisontell dragövning för rygg",
      category: "Rygg",
      difficulty: "Mellannivå",
      primaryMuscles: ["Latissimus", "Mellersta rygg"],
      secondaryMuscles: ["Biceps", "Bakre deltoider"],
      requiredEquipment: ["Skivstång"],
      movementPattern: "Pull",
      isCompound: true,
    },
    {
      name: "Chins",
      nameEn: "Pull-ups",
      description: "Vertikal dragövning med kroppsvikt",
      category: "Rygg",
      difficulty: "Avancerad",
      primaryMuscles: ["Latissimus"],
      secondaryMuscles: ["Biceps", "Bakre deltoider"],
      requiredEquipment: ["Chinsstång"],
      movementPattern: "Pull",
      isCompound: true,
    },
    {
      name: "Latdrag",
      nameEn: "Lat Pulldown",
      description: "Vertikal dragövning i maskin",
      category: "Rygg",
      difficulty: "Nybörjare",
      primaryMuscles: ["Latissimus"],
      secondaryMuscles: ["Biceps"],
      requiredEquipment: ["Latmaskin"],
      movementPattern: "Pull",
      isCompound: true,
    },
    {
      name: "Rodd med hantlar",
      nameEn: "Dumbbell Row",
      description: "Enarmad hantelrodd för rygg",
      category: "Rygg",
      difficulty: "Mellannivå",
      primaryMuscles: ["Latissimus", "Mellersta rygg"],
      secondaryMuscles: ["Biceps"],
      requiredEquipment: ["Hantlar", "Bänk"],
      movementPattern: "Pull",
      isCompound: true,
    },

    // BEN
    {
      name: "Knäböj",
      nameEn: "Barbell Squat",
      description: "Klassisk benövning med skivstång",
      category: "Ben",
      difficulty: "Avancerad",
      primaryMuscles: ["Quadriceps", "Gluteus"],
      secondaryMuscles: ["Baksida lår", "Core"],
      requiredEquipment: ["Skivstång", "Rack"],
      movementPattern: "Squat",
      isCompound: true,
    },
    {
      name: "Benpress",
      nameEn: "Leg Press",
      description: "Benövning i maskin",
      category: "Ben",
      difficulty: "Nybörjare",
      primaryMuscles: ["Quadriceps", "Gluteus"],
      secondaryMuscles: ["Baksida lår"],
      requiredEquipment: ["Benpress-maskin"],
      movementPattern: "Squat",
      isCompound: true,
    },
    {
      name: "Utfall",
      nameEn: "Lunges",
      description: "Enbenig benövning",
      category: "Ben",
      difficulty: "Mellannivå",
      primaryMuscles: ["Quadriceps", "Gluteus"],
      secondaryMuscles: ["Baksida lår"],
      requiredEquipment: ["Hantlar"],
      movementPattern: "Lunge",
      isCompound: true,
    },
    {
      name: "Rumänsk marklyft",
      nameEn: "Romanian Deadlift",
      description: "Baksida lår fokus",
      category: "Ben",
      difficulty: "Mellannivå",
      primaryMuscles: ["Baksida lår", "Gluteus"],
      secondaryMuscles: ["Nedre rygg"],
      requiredEquipment: ["Skivstång"],
      movementPattern: "Hinge",
      isCompound: true,
    },
    {
      name: "Benböj",
      nameEn: "Leg Curl",
      description: "Isolering baksida lår",
      category: "Ben",
      difficulty: "Nybörjare",
      primaryMuscles: ["Baksida lår"],
      secondaryMuscles: [],
      requiredEquipment: ["Benböjsmaskin"],
      movementPattern: "Isolation",
      isCompound: false,
    },
    {
      name: "Bensträck",
      nameEn: "Leg Extension",
      description: "Isolering quadriceps",
      category: "Ben",
      difficulty: "Nybörjare",
      primaryMuscles: ["Quadriceps"],
      secondaryMuscles: [],
      requiredEquipment: ["Bensträck-maskin"],
      movementPattern: "Isolation",
      isCompound: false,
    },

    // AXLAR
    {
      name: "Militärpress",
      nameEn: "Overhead Press",
      description: "Vertikal pressövning för axlar",
      category: "Axlar",
      difficulty: "Mellannivå",
      primaryMuscles: ["Främre deltoider", "Mellersta deltoider"],
      secondaryMuscles: ["Triceps", "Övre bröst"],
      requiredEquipment: ["Skivstång"],
      movementPattern: "Push",
      isCompound: true,
    },
    {
      name: "Sittande hantelpress",
      nameEn: "Seated Dumbbell Press",
      description: "Sittande axelpress med hantlar",
      category: "Axlar",
      difficulty: "Mellannivå",
      primaryMuscles: ["Främre deltoider", "Mellersta deltoider"],
      secondaryMuscles: ["Triceps"],
      requiredEquipment: ["Hantlar", "Bänk"],
      movementPattern: "Push",
      isCompound: true,
    },
    {
      name: "Sidlyft",
      nameEn: "Lateral Raises",
      description: "Isolering mellersta deltoider",
      category: "Axlar",
      difficulty: "Nybörjare",
      primaryMuscles: ["Mellersta deltoider"],
      secondaryMuscles: [],
      requiredEquipment: ["Hantlar"],
      movementPattern: "Isolation",
      isCompound: false,
    },
    {
      name: "Facepulls",
      nameEn: "Face Pulls",
      description: "Bakre deltoider och rotator cuff",
      category: "Axlar",
      difficulty: "Nybörjare",
      primaryMuscles: ["Bakre deltoider"],
      secondaryMuscles: ["Trapezius", "Rotator cuff"],
      requiredEquipment: ["Kabelmaskin"],
      movementPattern: "Pull",
      isCompound: false,
    },

    // BICEPS
    {
      name: "Bicepscurl med skivstång",
      nameEn: "Barbell Curl",
      description: "Klassisk bicepsövning",
      category: "Armar",
      difficulty: "Nybörjare",
      primaryMuscles: ["Biceps"],
      secondaryMuscles: ["Underarmar"],
      requiredEquipment: ["Skivstång"],
      movementPattern: "Pull",
      isCompound: false,
    },
    {
      name: "Bicepscurl med hantlar",
      nameEn: "Dumbbell Curl",
      description: "Alternativa bicepscurls",
      category: "Armar",
      difficulty: "Nybörjare",
      primaryMuscles: ["Biceps"],
      secondaryMuscles: ["Underarmar"],
      requiredEquipment: ["Hantlar"],
      movementPattern: "Pull",
      isCompound: false,
    },
    {
      name: "Hammarcurls",
      nameEn: "Hammer Curls",
      description: "Neutral grepp för biceps och brachialis",
      category: "Armar",
      difficulty: "Nybörjare",
      primaryMuscles: ["Biceps", "Brachialis"],
      secondaryMuscles: ["Underarmar"],
      requiredEquipment: ["Hantlar"],
      movementPattern: "Pull",
      isCompound: false,
    },

    // TRICEPS
    {
      name: "Skullcrushers",
      nameEn: "Lying Triceps Extension",
      description: "Liggande tricepspress",
      category: "Armar",
      difficulty: "Mellannivå",
      primaryMuscles: ["Triceps"],
      secondaryMuscles: [],
      requiredEquipment: ["Skivstång", "Bänk"],
      movementPattern: "Isolation",
      isCompound: false,
    },
    {
      name: "Triceps pushdown",
      nameEn: "Cable Triceps Pushdown",
      description: "Kabel tricepspress",
      category: "Armar",
      difficulty: "Nybörjare",
      primaryMuscles: ["Triceps"],
      secondaryMuscles: [],
      requiredEquipment: ["Kabelmaskin"],
      movementPattern: "Isolation",
      isCompound: false,
    },
    {
      name: "Franska pressen",
      nameEn: "Overhead Triceps Extension",
      description: "Överhuvud tricepspress",
      category: "Armar",
      difficulty: "Nybörjare",
      primaryMuscles: ["Triceps"],
      secondaryMuscles: [],
      requiredEquipment: ["Hantel"],
      movementPattern: "Isolation",
      isCompound: false,
    },

    // CORE
    {
      name: "Plank",
      nameEn: "Plank",
      description: "Statisk core-övning",
      category: "Core",
      difficulty: "Nybörjare",
      primaryMuscles: ["Core", "Raka bukmuskeln"],
      secondaryMuscles: ["Nedre rygg"],
      requiredEquipment: [],
      movementPattern: "Stability",
      isCompound: false,
    },
    {
      name: "Crunch",
      nameEn: "Abdominal Crunch",
      description: "Klassisk magövning",
      category: "Core",
      difficulty: "Nybörjare",
      primaryMuscles: ["Raka bukmuskeln"],
      secondaryMuscles: [],
      requiredEquipment: [],
      movementPattern: "Flexion",
      isCompound: false,
    },
    {
      name: "Rygglyft",
      nameEn: "Hyperextension",
      description: "Nedre rygg styrka",
      category: "Core",
      difficulty: "Nybörjare",
      primaryMuscles: ["Nedre rygg"],
      secondaryMuscles: ["Gluteus", "Baksida lår"],
      requiredEquipment: ["Hyperextension-bänk"],
      movementPattern: "Extension",
      isCompound: false,
    },

    // CARDIO
    {
      name: "Löpband",
      nameEn: "Treadmill",
      description: "Löpning på löpband",
      category: "Cardio",
      difficulty: "Nybörjare",
      primaryMuscles: ["Ben", "Hjärta"],
      secondaryMuscles: [],
      requiredEquipment: ["Löpband"],
      movementPattern: "Cardio",
      isCompound: true,
    },
    {
      name: "Roddmaskin",
      nameEn: "Rowing Machine",
      description: "Helkropps cardio",
      category: "Cardio",
      difficulty: "Mellannivå",
      primaryMuscles: ["Rygg", "Ben", "Hjärta"],
      secondaryMuscles: ["Armar", "Core"],
      requiredEquipment: ["Roddmaskin"],
      movementPattern: "Cardio",
      isCompound: true,
    },
    {
      name: "Cykel",
      nameEn: "Stationary Bike",
      description: "Stationär cykel",
      category: "Cardio",
      difficulty: "Nybörjare",
      primaryMuscles: ["Ben", "Hjärta"],
      secondaryMuscles: [],
      requiredEquipment: ["Motionscykel"],
      movementPattern: "Cardio",
      isCompound: true,
    },
  ];

  try {
    for (const exercise of exerciseData) {
      await db.insert(exercises).values(exercise).onConflictDoNothing();
    }
    console.log(`✅ Seeded ${exerciseData.length} exercises`);
  } catch (error) {
    console.error("Error seeding exercises:", error);
    throw error;
  }
}

export async function seedEquipment() {
  console.log("🌱 Seeding equipment catalog...");
  
  const equipmentData = [
    // Frivikter
    { name: "Skivstång", nameEn: "Barbell", category: "Frivikter", type: "Stång", description: "Standard olympisk skivstång" },
    { name: "Hantlar", nameEn: "Dumbbells", category: "Frivikter", type: "Hantlar", description: "Par av hantlar" },
    { name: "EZ-stång", nameEn: "EZ Bar", category: "Frivikter", type: "Stång", description: "Böjd stång för biceps/triceps" },
    { name: "Kettlebell", nameEn: "Kettlebell", category: "Frivikter", type: "Vikt", description: "Rysk kulvikt" },
    
    // Maskiner
    { name: "Benpress-maskin", nameEn: "Leg Press Machine", category: "Maskiner", type: "Ben", description: "Maskin för benpress" },
    { name: "Latmaskin", nameEn: "Lat Pulldown Machine", category: "Maskiner", type: "Rygg", description: "Latdragsmaskin" },
    { name: "Kabelmaskin", nameEn: "Cable Machine", category: "Maskiner", type: "Universal", description: "Justerbar kabelstation" },
    { name: "Smithmaskin", nameEn: "Smith Machine", category: "Maskiner", type: "Universal", description: "Guidad skivstång" },
    { name: "Benböjsmaskin", nameEn: "Leg Curl Machine", category: "Maskiner", type: "Ben", description: "Liggande benböj" },
    { name: "Bensträck-maskin", nameEn: "Leg Extension Machine", category: "Maskiner", type: "Ben", description: "Sitting bensträck" },
    { name: "Roddmaskin", nameEn: "Rowing Machine", category: "Maskiner", type: "Cardio", description: "Concept2 roddmaskin" },
    
    // Bänkar & Rack
    { name: "Bänk", nameEn: "Flat Bench", category: "Bänkar", type: "Platt", description: "Standard platt bänk" },
    { name: "Justerbar bänk", nameEn: "Adjustable Bench", category: "Bänkar", type: "Justerbar", description: "Lutning/sänkning" },
    { name: "Rack", nameEn: "Power Rack", category: "Rack", type: "Squat Rack", description: "Säkerhetsrack för knäböj" },
    { name: "Hyperextension-bänk", nameEn: "Hyperextension Bench", category: "Bänkar", type: "Rygglyft", description: "45-graders ryggbänk" },
    
    // Tillbehör
    { name: "Chinsstång", nameEn: "Pull-up Bar", category: "Tillbehör", type: "Kroppsvikt", description: "Fastsatt chinsstång" },
    { name: "Dip-station", nameEn: "Dip Station", category: "Tillbehör", type: "Kroppsvikt", description: "Parallella handtag för dips" },
    { name: "Viktbälte", nameEn: "Weight Belt", category: "Tillbehör", type: "Kroppsvikt", description: "Bälte för extra vikt" },
    { name: "Träningselastik", nameEn: "Resistance Bands", category: "Tillbehör", type: "Band", description: "Gummiband för motstånd" },
    { name: "Maghjul", nameEn: "Ab Wheel", category: "Tillbehör", type: "Core", description: "Rullhjul för magträning" },
    
    // Cardio
    { name: "Löpband", nameEn: "Treadmill", category: "Cardio", type: "Löpning", description: "Elektriskt löpband" },
    { name: "Motionscykel", nameEn: "Stationary Bike", category: "Cardio", type: "Cykling", description: "Spinningcykel" },
    { name: "Crosstrainer", nameEn: "Elliptical", category: "Cardio", type: "Elliptical", description: "Elliptisk träningsmaskin" },
    { name: "Stairmaster", nameEn: "Stair Climber", category: "Cardio", type: "Trappsteg", description: "Trappstegsmaskin" },
  ];

  try {
    for (const equipment of equipmentData) {
      await db.insert(equipmentCatalog).values(equipment).onConflictDoNothing();
    }
    console.log(`✅ Seeded ${equipmentData.length} equipment items`);
  } catch (error) {
    console.error("Error seeding equipment:", error);
    throw error;
  }
}

export async function runSeeds() {
  console.log("🌱 Starting database seeding...");
  
  try {
    await seedEquipment();
    await seedExercises();
    
    console.log("✅ Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    process.exit(1);
  }
}

// Run seeds if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeeds().then(() => process.exit(0));
}
