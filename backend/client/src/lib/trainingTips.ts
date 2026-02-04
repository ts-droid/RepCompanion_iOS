import type { UserProfile } from "@shared/schema";

export interface TrainingTip {
  id: string;
  category: "recovery" | "progression" | "safety" | "hydration" | "nutrition" | "motivation";
  message: string;
  icon: string;
  /**
   * Placement key for related promotional content/affiliate offers
   * This allows showing context-relevant ads/products with each tip
   * Example placements:
   * - "tip-nutrition" -> Protein powder, supplements
   * - "tip-recovery" -> Sleep trackers, foam rollers, massage guns
   * - "tip-hydration" -> Water bottles, electrolytes
   * - "tip-progression" -> Gym equipment, workout gear
   * - "tip-safety" -> Protective gear, form guides
   */
  relatedPromoPlacement?: string;
}

/**
 * Generates personalized training tips based on user profile
 */
export function getPersonalizedTips(profile: UserProfile | undefined): TrainingTip[] {
  if (!profile) {
    return getDefaultTips();
  }

  const tips: TrainingTip[] = [];
  const age = profile.age || 30; // Use profile age directly

  // Age-specific recovery tips
  if (age >= 50) {
    tips.push({
      id: "recovery-senior",
      category: "recovery",
      message: `Som ${age}-åring är återhämtning avgörande. Se till att sova 7-8 timmar per natt och ät tillräckligt med protein (ca 1.6-2g per kg kroppsvikt) för att stödja muskelåterhämtning och bibehållen styrka.`,
      icon: "😴",
      relatedPromoPlacement: "tip-recovery",
    });
  } else if (age >= 40) {
    tips.push({
      id: "recovery-middle",
      category: "recovery",
      message: "Återhämtning blir viktigare med åldern. Sträva efter 7-9 timmars sömn och överväg aktiv återhämtning som lätt yoga eller promenader mellan intensiva pass.",
      icon: "😴",
      relatedPromoPlacement: "tip-recovery",
    });
  } else {
    tips.push({
      id: "recovery-young",
      category: "recovery",
      message: "Optimera din återhämtning med tillräcklig sömn (7-9 timmar) och rätt näring. Din kropp bygger muskler när du vilar, inte när du tränar!",
      icon: "😴",
      relatedPromoPlacement: "tip-recovery",
    });
  }

  // Goal-specific tips (with null-safety)
  const goalStrength = profile.goalStrength ?? 0;
  const goalEndurance = profile.goalEndurance ?? 0;
  const goalVolume = profile.goalVolume ?? 0;

  if (goalStrength >= 30) {
    tips.push({
      id: "progression-strength",
      category: "progression",
      message: "För styrkeframsteg: Försök att successivt öka vikten eller antalet repetitioner varje vecka. Progressive overload är nyckeln till att bygga styrka över tid.",
      icon: "💪",
      relatedPromoPlacement: "tip-progression",
    });
  }

  if (goalEndurance >= 30) {
    tips.push({
      id: "progression-endurance",
      category: "progression",
      message: "För ökad uthållighet: Öka gradvis tiden eller intensiteten i dina cardiopass. Försök att lägga till 5-10% volym per vecka.",
      icon: "🏃",
      relatedPromoPlacement: "tip-progression",
    });
  }

  if (goalVolume >= 30) {
    tips.push({
      id: "progression-volume",
      category: "progression",
      message: "För muskelvolym: Fokusera på tid under spänning (8-12 reps) och se till att äta i ett litet kalorioverskott med tillräckligt protein.",
      icon: "🔥",
      relatedPromoPlacement: "tip-progression",
    });
  }

  // Motivation-specific tips
  if (profile.motivationType === "Rehabilitering") {
    tips.push({
      id: "safety-rehab",
      category: "safety",
      message: "Lyssna noga på din kropp under rehabilitering. Om du känner smärta (inte bara obehag), stoppa övningen. Det är bättre att ta en extra vilodag än att riskera en skada.",
      icon: "⚠️",
      relatedPromoPlacement: "tip-safety",
    });
  } else {
    tips.push({
      id: "safety-general",
      category: "safety",
      message: "Skillnaden mellan produktiv ansträngning och smärta är viktig. Stoppa vid skarp smärta och konsultera en professionell om det upprepas.",
      icon: "⚠️",
      relatedPromoPlacement: "tip-safety",
    });
  }

  // Universal tips
  tips.push(
    {
      id: "hydration",
      category: "hydration",
      message: "Hydrering påverkar prestanda mer än du tror. Drick vatten under och mellan passen. Mål: minst 2-3 liter per dag, mer vid intensiv träning.",
      icon: "💧",
      relatedPromoPlacement: "tip-hydration",
    },
    {
      id: "nutrition-protein",
      category: "nutrition",
      message: profile.sessionsPerWeek 
        ? `Med ${profile.sessionsPerWeek} pass per vecka behöver din kropp tillräckligt bränsle. Prioritera protein efter träning och sprid ut intaget över dagen för bästa resultat.`
        : "Din kropp behöver tillräckligt bränsle för att bygga muskler. Prioritera protein efter träning och sprid ut intaget över dagen för bästa resultat.",
      icon: "🍗",
      relatedPromoPlacement: "tip-nutrition",
    },
    {
      id: "consistency",
      category: "motivation",
      message: "Konsistens slår perfekt träning varje gång. Det är bättre med ett bra pass per vecka i ett år än perfekta pass i en månad.",
      icon: "🎯",
      relatedPromoPlacement: "tip-motivation",
    },
    {
      id: "warmup",
      category: "safety",
      message: "Hoppa aldrig över uppvärmningen! 5-10 minuter kan förhindra skador och förbättra din prestation under passet.",
      icon: "🔥",
      relatedPromoPlacement: "tip-safety",
    }
  );

  // Sport-specific tips
  if (profile.specificSport && profile.specificSport !== "Ingen specifik sport") {
    tips.push({
      id: "sport-specific",
      category: "motivation",
      message: `Din träning är anpassad för ${profile.specificSport}. Kom ihåg att sportspecifik träning kompletterar, men inte ersätter, grundläggande styrka och kondition.`,
      icon: "⚽",
      relatedPromoPlacement: "tip-sport-specific",
    });
  }

  return tips;
}

function getDefaultTips(): TrainingTip[] {
  return [
    {
      id: "default-workout",
      category: "motivation",
      message: "Träningsdag! Mät effekten av din aktivitet genom att ansluta din pulsmätare.",
      icon: "💪",
      relatedPromoPlacement: "tip-motivation",
    },
    {
      id: "default-hydration",
      category: "hydration",
      message: "Glöm inte att dricka vatten! Hydrering är avgörande för prestanda och återhämtning.",
      icon: "💧",
      relatedPromoPlacement: "tip-hydration",
    },
  ];
}


/**
 * Get a random tip from the list, optionally filtered by category
 */
export function getRandomTip(
  tips: TrainingTip[], 
  excludeIds: string[] = [],
  category?: TrainingTip["category"]
): TrainingTip | null {
  let filteredTips = tips.filter(tip => !excludeIds.includes(tip.id));
  
  if (category) {
    filteredTips = filteredTips.filter(tip => tip.category === category);
  }
  
  if (filteredTips.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * filteredTips.length);
  return filteredTips[randomIndex];
}

/**
 * Get dismissed tip IDs from localStorage
 */
export function getDismissedTips(): string[] {
  try {
    const stored = localStorage.getItem("dismissedTips");
    if (!stored) return [];
    
    const data = JSON.parse(stored);
    const today = new Date().toDateString();
    
    // Reset dismissed tips daily
    if (data.date !== today) {
      localStorage.removeItem("dismissedTips");
      return [];
    }
    
    return data.tipIds || [];
  } catch {
    return [];
  }
}

/**
 * Mark a tip as dismissed
 */
export function dismissTip(tipId: string): void {
  try {
    const dismissed = getDismissedTips();
    const today = new Date().toDateString();
    
    localStorage.setItem("dismissedTips", JSON.stringify({
      date: today,
      tipIds: [...dismissed, tipId],
    }));
  } catch (error) {
    console.error("Failed to save dismissed tip:", error);
  }
}
