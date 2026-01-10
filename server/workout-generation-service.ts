import { db } from "./db";
import { userProfiles, userEquipment, equipmentCatalog, programTemplates } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { filterExercisesByUserEquipment } from "./exercise-matcher";

/**
 * Workout Generation Service
 * 
 * Aggregates user profile data, equipment, and 1RM values to build
 * prompts for DeepSeek API workout program generation.
 * 
 * This service implements the hybrid approach:
 * - DeepSeek generates the workout program structure
 * - Weight calculations are done locally using 1RM formulas
 */

export interface WorkoutGenerationInput {
  gender: string;
  age: number;
  weight_kg: number;
  height_cm: number;
  training_level: string;
  main_goal: string;
  motivation_type?: string;
  specific_sport?: string;
  distribution: {
    strength_percent: number;
    hypertrophy_percent: number;
    endurance_percent: number;
    cardio_percent: number;
  };
  sessions_per_week: number;
  session_length_minutes: number;
  available_equipment: string[];
  filtered_exercises?: string[]; // Pre-filtered exercise names from catalog
  one_rm_values?: {
    bench?: number;
    ohp?: number;
    deadlift?: number;
    squat?: number;
    latpull?: number;
  };
}

export class WorkoutGenerationService {
  /**
   * Get all user data needed for workout generation
   */
  async getUserWorkoutData(userId: string): Promise<WorkoutGenerationInput | null> {
    // Fetch user profile
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));

    if (!profile) {
      return null;
    }

    // Fetch user's equipment
    const userEquipmentList = await db
      .select({
        name: userEquipment.equipmentName,
      })
      .from(userEquipment)
      .where(eq(userEquipment.userId, userId));

    // Get unique equipment names
    const availableEquipment = Array.from(new Set(userEquipmentList.map(e => e.name)));

    // Map sex to gender format expected by DeepSeek
    const genderMap: Record<string, string> = {
      'man': 'Man',
      'kvinna': 'Kvinna',
      'male': 'Man',
      'female': 'Kvinna',
      'icke-binär': 'Icke-binär',
      'annat': 'Annat'
    };
    const gender = genderMap[profile.sex?.toLowerCase() || ''] || 'Annat';

    // Map motivation type to main_goal (backwards compatible with old trainingGoals)
    const goalMap: Record<string, string> = {
      'fitness': 'Generell fitness',
      'viktminskning': 'Viktminskning och hälsa',
      'rehabilitering': 'Rehabilitering',
      'hälsa_livsstil': 'Hälsa och livsstil',
      'sport': 'Sportprestation',
      // Old values for backwards compatibility
      'hälsa': 'Generell fitness',
      'styrka': 'Muskelökning',
      'estetik': 'Muskelökning',
    };
    const motivation_type = profile.motivationType || profile.trainingGoals || 'fitness';
    const main_goal = goalMap[motivation_type.toLowerCase()] || 'Generell fitness';

    // Map training level from Swedish to display format
    const levelMap: Record<string, string> = {
      'nybörjare': 'Nybörjare',
      'van': 'Van',
      'mycket_van': 'Mycket van',
      'elit': 'Elit',
      // Old values for backwards compatibility
      'mellannivå': 'Van',
      'avancerad': 'Mycket van',
    };
    let training_level = levelMap[profile.trainingLevel?.toLowerCase() || ''] || 'Van';
    
    // If no explicit training level and user has 1RM data, we can estimate
    if (!profile.trainingLevel && profile.oneRmBench) {
      // Basic heuristic: if they track 1RM, they're likely intermediate+
      training_level = 'Van';
    }

    // Get filtered exercises based on user's equipment
    const filteredExercises = await filterExercisesByUserEquipment(userId, profile.selectedGymId || undefined);
    const filteredExerciseNames = filteredExercises.map(ex => ex.nameEn);

    console.log(`[WORKOUT GENERATION] Filtered ${filteredExerciseNames.length} exercises for user ${userId}`);
    
    // Fallback: If no exercises match, warn but don't block AI generation
    if (filteredExerciseNames.length === 0) {
      console.warn(`[WORKOUT GENERATION] No filtered exercises for user ${userId} - AI will use equipment list only`);
    }

    return {
      gender,
      age: profile.age || 30,
      weight_kg: profile.bodyWeight || 75,
      height_cm: profile.height || 175,
      training_level,
      main_goal,
      motivation_type,
      specific_sport: profile.specificSport || undefined,
      distribution: {
        strength_percent: profile.goalStrength || 50,
        hypertrophy_percent: profile.goalVolume || 50,
        endurance_percent: profile.goalEndurance || 50,
        cardio_percent: profile.goalCardio || 50,
      },
      sessions_per_week: profile.sessionsPerWeek || 3,
      session_length_minutes: profile.sessionDuration || 60,
      available_equipment: availableEquipment,
      filtered_exercises: filteredExerciseNames,
      one_rm_values: {
        bench: profile.oneRmBench || undefined,
        ohp: profile.oneRmOhp || undefined,
        deadlift: profile.oneRmDeadlift || undefined,
        squat: profile.oneRmSquat || undefined,
        latpull: profile.oneRmLatpull || undefined,
      },
    };
  }

  /**
   * Get extended profile data for V2 generation with bodyFat%, muscleMass%, etc.
   * This includes all fields needed for PromptContextV2
   */
  async getExtendedProfileData(userId: string) {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));

    if (!profile) {
      return null;
    }

    // Get equipment list
    const userEquipmentList = await db
      .select({
        name: userEquipment.equipmentName,
      })
      .from(userEquipment)
      .where(eq(userEquipment.userId, userId));

    const availableEquipment = userEquipmentList.map(e => e.name);
    const equipmentList = availableEquipment.length > 0 
      ? availableEquipment.join(', ') 
      : 'Endast kroppsvikt';

    // Calculate weekday list
    const weekdaySchedule: Record<number, string[]> = {
      2: ["Måndag", "Torsdag"],
      3: ["Måndag", "Onsdag", "Fredag"],
      4: ["Måndag", "Tisdag", "Torsdag", "Lördag"],
      5: ["Måndag", "Tisdag", "Torsdag", "Fredag", "Lördag"],
      6: ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"],
      7: ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"]
    };
    const sessionsCount = profile.sessionsPerWeek || 3;
    const weekdays = weekdaySchedule[sessionsCount] || weekdaySchedule[3];
    const weekdayList = weekdays.join(", ");

    return {
      age: profile.age ?? undefined,
      sex: profile.sex ?? undefined,
      bodyWeight: profile.bodyWeight ?? undefined,
      height: profile.height ?? undefined,
      bodyFatPercent: profile.bodyFatPercent ?? undefined, // New for V2
      muscleMassPercent: profile.muscleMassPercent ?? undefined, // New for V2
      trainingLevel: profile.trainingLevel ?? undefined,
      motivationType: profile.motivationType ?? undefined,
      trainingGoals: profile.trainingGoals ?? undefined,
      specificSport: profile.specificSport ?? undefined,
      oneRmBench: profile.oneRmBench ?? undefined,
      oneRmOhp: profile.oneRmOhp ?? undefined,
      oneRmDeadlift: profile.oneRmDeadlift ?? undefined,
      oneRmSquat: profile.oneRmSquat ?? undefined,
      oneRmLatpull: profile.oneRmLatpull ?? undefined,
      currentPassNumber: profile.currentPassNumber ?? undefined,
      goalStrength: profile.goalStrength || 50,
      goalVolume: profile.goalVolume || 50,
      goalEndurance: profile.goalEndurance || 50,
      goalCardio: profile.goalCardio || 50,
      sessionsPerWeek: profile.sessionsPerWeek || 3,
      sessionDuration: profile.sessionDuration || 60,
      weekdayList,
      equipmentList,
    };
  }

  /**
   * Build the user content - optimized ChatGPT prompt with placeholders
   */
  buildUserPrompt(data: WorkoutGenerationInput): string {
    const equipmentList = data.available_equipment.join(', ');
    
    let prompt = `Skapa ett detaljerat träningsprogram för en hel vecka baserat på följande användardata:

---
Kön: ${data.gender}
Ålder: ${data.age} år
Vikt: ${data.weight_kg} kg
Längd: ${data.height_cm} cm
Träningsnivå: ${data.training_level}

Huvudsakligt träningsmål: ${data.main_goal}

Träningsfördelning:
- Styrka: ${data.distribution.strength_percent}%
- Hypertrofi: ${data.distribution.hypertrophy_percent}%
- Uthållighet: ${data.distribution.endurance_percent}%
- Cardio: ${data.distribution.cardio_percent}%
(Summa: 100%)

Antal träningspass per vecka: ${data.sessions_per_week}
Max passlängd: ${data.session_length_minutes} minuter
Tillgänglig utrustning: ${equipmentList}
`;

    // Add filtered exercises list if available (improves AI matching)
    if (data.filtered_exercises && data.filtered_exercises.length > 0) {
      prompt += `\nTillgängliga övningar (${data.filtered_exercises.length} st - ALLA NAMN ÄR PÅ ENGELSKA, använd dessa exakt):\n`;
      prompt += data.filtered_exercises.join(', ') + '\n';
    } else {
      // No filtered exercises - AI will generate based on equipment list only
      console.warn(`[PROMPT] No filtered exercises provided - AI will generate based on equipment`);
    }

    // Add sport-specific info if applicable
    if (data.motivation_type === "sport" && data.specific_sport) {
      prompt += `\nSpecifik sport: ${data.specific_sport} (anpassa programmet för denna sport)\n`;
    }

    prompt += `
---

**Instruktioner:**

1. Analysera användarens nivå, ålder och målfördelning.
2. Skapa ett träningsupplägg som är balanserat och säkert över veckan.
3. **Föreslå specifika veckodagar att träna på (t.ex. måndag, onsdag, fredag)** med minst 1 vilodag mellan styrke-/volymintensiva pass.
4. Dela upp passen enligt träningsfördelningen.
5. För varje pass, inkludera:
   - Passnamn + målfokus
   - Syfte med passet (kortfattat)
   - Uppvärmning (5–10 min) – dynamiska övningar relaterade till passet
   - Huvuddel:
     - Övningar (endast med angiven utrustning)
     - Set × reps
     - Vilotid
     - Förslag på startvikt i kg (justerat för ålder/nivå)
     - Teknik-/fokustips
   - Nedvarvning (≈5 min): statisk stretching
   - Cardio (om det ingår i målfördelningen): typ, intensitet, tid
6. I slutet: Ge 2–3 korta, individanpassade råd om t.ex. återhämtning, sömn, progression, eller tekniktips.

**Regler:**
- **KRITISKT**: Använd ENDAST övningar från listan "Tillgängliga övningar" ovan. Använd de exakta engelska namnen som anges i listan.
- **KRITISKT**: Alla övningsnamn MÅSTE vara på ENGELSKA och exakt matcha namnen i listan (t.ex. "Bench Press", "Squat", "Deadlift", "Cable Row")
- **KRITISKT**: ALDRIG använda svenska övningsnamn (t.ex. INTE "Bänkpress", "Skivstångs bänkpress", "Marklyft" - använd engelska motsvarigheter från listan)
- Använd endast angiven utrustning.
- Följ användarens träningsfördelning i schemat.
- Anpassa volym och intensitet efter träningsnivå.
- Undvik att schemalägga tunga styrkepass dagarna efter varandra.
- **KRITISKT**: VARJE PASS måste vara ${data.session_length_minutes} minuter (±10% tolerans = ${Math.floor(data.session_length_minutes * 0.9)}-${Math.ceil(data.session_length_minutes * 1.1)} min).
  - Exempel: 60 min målsatt tid = 54-66 min acceptabelt
  - Exempel: 45 min målsatt tid = 40-50 min acceptabelt
  - Justera antal övningar, set och vilotider för att matcha måltiden EXAKT.
- **KRITISKT - REPS vs TID**:
  - **Reps-baserade övningar**: Använd ALLTID repetitioner (t.ex. "8-12", "5", "10-15") för alla styrkeövningar som involverar rörelser upp och ner.
    - Exempel: Dumbbell Press, Bench Press, Squats, Deadlifts, Rows, Curls, Push-ups, Pull-ups, Lunges
  - **Tidsbaserade övningar**: Använd ENDAST tid (t.ex. "30 sec", "60 sec") för statiska hållövningar.
    - Exempel ENDAST: Plank, Side Plank, Wall Sit, Dead Hang, Hollow Hold, L-Sit
  - **Fel exempel**: "Dumbbell Press: 60 sec" eller "Bench Press: 45 sec" - dessa ska ha reps!
  - **Rätt exempel**: "Dumbbell Press: 8-12", "Plank: 60 sec"
- Svara med ENDAST valid JSON enligt schemat i systemmeddelandet.

Börja nu med att analysera profilen och skapa ett fullständigt veckoschema som JSON.`;

    return prompt;
  }

  /**
   * Get system prompt - optimized for ChatGPT
   */
  getSystemPrompt(): string {
    return `Du är en licensierad träningsfysiolog och expert på styrketräning, nutrition och periodisering. Du skapar individuellt anpassade, säkra och effektiva träningsscheman baserat på personens profil och utrustning. Du optimerar upplägget för prestation, återhämtning och progression. Du tar hänsyn till ålder, träningsnivå, mål och återhämtningstid mellan passen. Alla svar ska vara på svenska, strukturerade och lätta att följa.

VIKTIGT:
- Svara ENDAST med valid JSON enligt schemat nedan.
- Inga förklaringar, ingen markdown, ingen extra text – bara JSON.
- Alla nycklar ska finnas med. Om något inte är relevant, sätt värdet till null eller tom array.

KRITISKT - PASSLÄNGD (estimated_duration_minutes):
- Varje pass MÅSTE ha estimated_duration_minutes inom ±10% från användarens max passlängd.
- Exempel: Om användaren vill ha 60 min pass, accepteras 54-66 min (60 ±10%).
- Exempel: Om användaren vill ha 45 min pass, accepteras 40-50 min (45 ±10%).
- Justera antal övningar, set och vilotider för att matcha måltiden EXAKT.
- Detta valideras automatiskt - program som inte följer detta AVVISAS.

KRITISKT - MUSCLE_FOCUS för varje pass:
- Varje pass MÅSTE ha ett "muscle_focus" värde som beskriver huvudsaklig muskelgrupp/fokus.
- Exempel värden: "Chest", "Back", "Legs", "Upper Body - Push", "Upper Body - Pull", "Full Body", "Shoulders", "Arms", "Glutes and Quads"
- Basera detta på exercises' "target_muscles" i main_work sektionen.
- Använd engelska namn för muskelgrupper.

KRITISKT - REPS vs TID för "reps" fältet i main_work:
- **Reps-baserade övningar** (alla dynamiska styrkeövningar): Använd ALLTID repetitioner som värde.
  - Format: "8-12", "5", "10-15", "6-8", etc.
  - Exempel övningar: Dumbbell Press, Bench Press, Barbell Squat, Deadlift, Bent-over Row, Lat Pulldown, Shoulder Press, Bicep Curl, Tricep Extension, Leg Press, Push-ups, Pull-ups, Lunges, Step-ups
  - **ALDRIG** skriv tid (t.ex. "60 sec") för dessa övningar!
  
- **Tidsbaserade övningar** (endast statiska hållövningar): Använd tid som värde.
  - Format: "30 sec", "60 sec", "45 sec", etc.
  - Exempel övningar: Plank, Side Plank, Wall Sit, Dead Hang, Hollow Hold, L-Sit, Boat Pose
  - Dessa är MYCKET SÄLLSYNTA i styrketräningsprogram!
  
- **Valideringsregel**: Om en övning involverar rörelse upp/ner/fram/tillbaka → REPS. Om den är statisk hållning → TID.
- **Fel exempel**: "Dumbbell Press: 60 sec" ❌ (ska vara "8-12")
- **Rätt exempel**: "Dumbbell Press: 8-12" ✅, "Plank: 60 sec" ✅

JSON-SCHEMA:
{
  "user_profile": {
    "gender": "string",
    "age": 0,
    "weight_kg": 0,
    "height_cm": 0,
    "training_level": "string",
    "main_goal": "string",
    "distribution": {
      "strength_percent": 0,
      "hypertrophy_percent": 0,
      "endurance_percent": 0,
      "cardio_percent": 0
    },
    "sessions_per_week": 0,
    "session_length_minutes": 0,
    "available_equipment": ["string"]
  },
  "program_overview": {
    "week_focus_summary": "string",
    "expected_difficulty": "string",
    "notes_on_progression": "string"
  },
  "weekly_sessions": [
    {
      "session_number": 0,
      "weekday": "string",
      "session_name": "string",
      "session_type": "string",
      "estimated_duration_minutes": 0,
      "muscle_focus": "string",
      "warmup": [
        {
          "exercise_name": "string",
          "sets": 0,
          "reps_or_duration": "string",
          "notes": "string"
        }
      ],
      "main_work": [
        {
          "exercise_name": "string",
          "sets": 0,
          "reps": "string",
          "rest_seconds": 0,
          "tempo": "string",
          "suggested_weight_kg": 0,
          "suggested_weight_notes": "string",
          "target_muscles": ["string"],
          "required_equipment": ["string"],
          "technique_cues": ["string"]
        }
      ],
      "cooldown": [
        {
          "exercise_name": "string",
          "duration_or_reps": "string",
          "notes": "string"
        }
      ]
    }
  ],
  "recovery_tips": ["string", "string", "string"]
}`;
  }

  /**
   * Check if user can generate a new program
   * Returns { allowed: boolean, remaining: number, resetDate: Date | null }
   * Limits to 5 generations per week (Monday-Sunday)
   * Dev users bypass rate limiting
   */
  async canGenerateProgram(userId: string): Promise<{ allowed: boolean; remaining: number; resetDate: Date | null }> {
    // Dev users bypass rate limiting
    if (userId === "dev-user-123") {
      return { allowed: true, remaining: 999, resetDate: null };
    }

    const profile = await db
      .select({
        programGenerationsThisWeek: userProfiles.programGenerationsThisWeek,
        weekStartDate: userProfiles.weekStartDate,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (profile.length === 0) {
      return { allowed: true, remaining: 5, resetDate: null };
    }

    const now = new Date();
    const weekStart = profile[0].weekStartDate;
    const generationsThisWeek = profile[0].programGenerationsThisWeek || 0;

    // Check if we need to reset the week counter
    // Week starts on Monday
    const currentWeekStart = this.getWeekStart(now);
    const needsReset = !weekStart || weekStart < currentWeekStart;

    if (needsReset) {
      // New week - reset counter
      return { allowed: true, remaining: 5, resetDate: this.getWeekEnd(currentWeekStart) };
    }

    // Check if user has reached the limit
    const remaining = Math.max(0, 5 - generationsThisWeek);
    const allowed = generationsThisWeek < 5;
    const resetDate = this.getWeekEnd(currentWeekStart);

    return { allowed, remaining, resetDate };
  }

  /**
   * Get the start of the week (Monday 00:00:00)
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Get the end of the week (Sunday 23:59:59)
   */
  private getWeekEnd(weekStart: Date): Date {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}

export const workoutGenerationService = new WorkoutGenerationService();
