import { storage } from "./storage";
import type { InsertTrainingTip } from "@shared/schema";

/**
 * Seed training tips database with Swedish tips
 * These replace the hardcoded tips in client/src/lib/trainingTips.ts
 */

const trainingTipsSeed: InsertTrainingTip[] = [
  // Recovery tips (age-based)
  {
    message: "Som 50+ är återhämtning avgörande. Se till att sova 7-8 timmar per natt och ät tillräckligt med protein (ca 1.6-2g per kg kroppsvikt) för att stödja muskelåterhämtning och bibehållen styrka.",
    category: "recovery",
    workoutTypes: [],
    icon: "moon",
    relatedPromoPlacement: "tip-recovery",
    isActive: true,
    priority: 90,
  },
  {
    message: "Återhämtning blir viktigare med åldern. Sträva efter 7-9 timmars sömn och överväg aktiv återhämtning som lätt yoga eller promenader mellan intensiva pass.",
    category: "recovery",
    workoutTypes: [],
    icon: "moon",
    relatedPromoPlacement: "tip-recovery",
    isActive: true,
    priority: 85,
  },
  {
    message: "Optimera din återhämtning med tillräcklig sömn (7-9 timmar) och rätt näring. Din kropp bygger muskler när du vilar, inte när du tränar!",
    category: "recovery",
    workoutTypes: [],
    icon: "moon",
    relatedPromoPlacement: "tip-recovery",
    isActive: true,
    priority: 80,
  },
  
  // Progression tips (goal-based)
  {
    message: "För styrkeframsteg: Försök att successivt öka vikten eller antalet repetitioner varje vecka. Progressive overload är nyckeln till att bygga styrka över tid.",
    category: "progression",
    workoutTypes: ["strength", "hypertrophy"],
    icon: "trending-up",
    relatedPromoPlacement: "tip-progression",
    isActive: true,
    priority: 85,
  },
  {
    message: "För ökad uthållighet: Öka gradvis tiden eller intensiteten i dina cardiopass. Försök att lägga till 5-10% volym per vecka.",
    category: "progression",
    workoutTypes: ["cardio", "endurance"],
    icon: "activity",
    relatedPromoPlacement: "tip-progression",
    isActive: true,
    priority: 80,
  },
  {
    message: "För muskelvolym: Fokusera på tid under spänning (8-12 reps) och se till att äta i ett litet kalorioverskott med tillräckligt protein.",
    category: "progression",
    workoutTypes: ["hypertrophy"],
    icon: "flame",
    relatedPromoPlacement: "tip-progression",
    isActive: true,
    priority: 85,
  },
  
  // Safety tips
  {
    message: "Lyssna noga på din kropp under rehabilitering. Om du känner smärta (inte bara obehag), stoppa övningen. Det är bättre att ta en extra vilodag än att riskera en skada.",
    category: "safety",
    workoutTypes: [],
    icon: "alert-triangle",
    relatedPromoPlacement: "tip-safety",
    isActive: true,
    priority: 95,
  },
  {
    message: "Skillnaden mellan produktiv ansträngning och smärta är viktig. Stoppa vid skarp smärta och konsultera en professionell om det upprepas.",
    category: "safety",
    workoutTypes: [],
    icon: "alert-triangle",
    relatedPromoPlacement: "tip-safety",
    isActive: true,
    priority: 90,
  },
  {
    message: "Hoppa aldrig över uppvärmningen! 5-10 minuter kan förhindra skador och förbättra din prestation under passet.",
    category: "safety",
    workoutTypes: [],
    icon: "flame",
    relatedPromoPlacement: "tip-safety",
    isActive: true,
    priority: 100,
  },
  
  // Hydration tips
  {
    message: "Hydrering påverkar prestanda mer än du tror. Drick vatten under och mellan passen. Mål: minst 2-3 liter per dag, mer vid intensiv träning.",
    category: "hydration",
    workoutTypes: [],
    icon: "droplet",
    relatedPromoPlacement: "tip-hydration",
    isActive: true,
    priority: 95,
  },
  {
    message: "Glöm inte att dricka vatten! Hydrering är avgörande för prestanda och återhämtning.",
    category: "hydration",
    workoutTypes: [],
    icon: "droplet",
    relatedPromoPlacement: "tip-hydration",
    isActive: true,
    priority: 85,
  },
  
  // Nutrition tips
  {
    message: "Din kropp behöver tillräckligt bränsle för att bygga muskler. Prioritera protein efter träning och sprid ut intaget över dagen för bästa resultat.",
    category: "nutrition",
    workoutTypes: [],
    icon: "utensils",
    relatedPromoPlacement: "tip-nutrition",
    isActive: true,
    priority: 90,
  },
  
  // Motivation tips
  {
    message: "Konsistens slår perfekt träning varje gång. Det är bättre med ett bra pass per vecka i ett år än perfekta pass i en månad.",
    category: "motivation",
    workoutTypes: [],
    icon: "target",
    relatedPromoPlacement: "tip-motivation",
    isActive: true,
    priority: 85,
  },
  {
    message: "Träningsdag! Mät effekten av din aktivitet genom att ansluta din pulsmätare.",
    category: "motivation",
    workoutTypes: [],
    icon: "heart",
    relatedPromoPlacement: "tip-motivation",
    isActive: true,
    priority: 70,
  },
  {
    message: "Din träning är anpassad för din sport. Kom ihåg att sportspecifik träning kompletterar, men inte ersätter, grundläggande styrka och kondition.",
    category: "motivation",
    workoutTypes: [],
    icon: "trophy",
    relatedPromoPlacement: "tip-sport-specific",
    isActive: true,
    priority: 75,
  },
];

async function seedTrainingTips() {
  console.log("🌱 Starting training tips seed...");
  
  try {
    // Check if tips already exist
    const existingTips = await storage.getTrainingTips({ isActive: true });
    
    if (existingTips.length > 0) {
      console.log(`✓ Found ${existingTips.length} existing tips, skipping seed`);
      return;
    }
    
    // Create all tips
    for (const tip of trainingTipsSeed) {
      await storage.createTrainingTip(tip);
    }
    
    console.log(`✓ Successfully seeded ${trainingTipsSeed.length} training tips`);
  } catch (error) {
    console.error("❌ Error seeding training tips:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTrainingTips()
    .then(() => {
      console.log("✓ Seed completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seed failed:", error);
      process.exit(1);
    });
}

export { seedTrainingTips, trainingTipsSeed };
