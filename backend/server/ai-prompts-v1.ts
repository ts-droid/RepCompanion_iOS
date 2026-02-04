/**
 * AI Prompts V1 - Original Implementation
 * Backup of existing prompt system for rollback capability
 */

export interface PromptContext {
  profile: {
    goalStrength: number;
    goalVolume: number;
    goalEndurance: number;
    goalCardio: number;
    sessionsPerWeek: number;
    sessionDuration?: number;
  };
  equipmentList: string;
  sessionDuration: number;
  exerciseRange: string;
  setsPerExerciseRange: string;
  totalSetRange: string;
  sessionsCount: number;
  weekdays: string[];
  weekdayList: string;
}

/**
 * Build optimized system prompt for DeepSeek Reasoner
 * This prompt is designed for structured JSON output with strict time constraints
 */
export function buildSystemPromptV1(): string {
  return `Du är en expert tränare och AI-assistent specialiserad på att skapa personliga träningsprogram.

Din expertis:
- Träningsperiodisering och progression
- Muskelanpassning och återhämtning
- Effektiv tidsplanering
- Balanserad muskelgruppsfördelning

Primära mål:
1. Skapa säkra, effektiva träningsprogram anpassade efter användarens mål och utrustning
2. Balansera muskelgrupper över veckan (48h återhämtning mellan samma muskelgrupp)
3. Optimera volym och intensitet baserat på målvikter (styrka, volym, uthållighet, kondition)
4. Följa tidskrav exakt (±10% tolerans)

KRITISKA REGLER:
- ALLTID använd ENGELSKA övningsnamn (t.ex. "Bench Press", "Squat", "Deadlift")
- ALLTID inkludera "equipment" array med exakta utrustningsnamn
- ALLTID inkludera "muscleGroups" array för varje övning
- Svara ENDAST med giltig JSON (ingen markdown, inga förklaringar)

Du kommer att få användardata och måste generera ett strukturerat 4-veckors träningsprogram.`;
}

/**
 * Calculate number of passes based on training frequency
 * 1-2 sessions/week -> 2 passes (A, B cycle)
 * 3 sessions/week -> 3 passes (A, B, C cycle)
 * 4+ sessions/week -> 4 passes (A, B, C, D cycle)
 */
function calculatePassesPerCycle(sessionsPerWeek: number): number {
  if (sessionsPerWeek <= 2) return 2;
  if (sessionsPerWeek === 3) return 3;
  return 4;
}

/**
 * Build optimized user prompt with complete workout parameters
 */
export function buildUserPromptV1(context: PromptContext): string {
  const { 
    profile, 
    equipmentList, 
    sessionDuration, 
    exerciseRange, 
    setsPerExerciseRange, 
    totalSetRange, 
    sessionsCount, 
    weekdays, 
    weekdayList 
  } = context;

  const passesPerCycle = calculatePassesPerCycle(profile.sessionsPerWeek);
  const passNames = ['A', 'B', 'C', 'D'].slice(0, passesPerCycle);
  const cycleDurationWeeks = Math.ceil(passesPerCycle / profile.sessionsPerWeek) * 2; // 2 full weeks per cycle

  return `Du är en expert-tränare med specialistkompetens inom tidsoptimering och träningsperiodisering. Generera ett personligt anpassat träningsprogram baserat på dessa preferenser:

**Träningsmål:**
- Styrka: ${profile.goalStrength}/100
- Volym: ${profile.goalVolume}/100
- Uthållighet: ${profile.goalEndurance}/100
- Kondition: ${profile.goalCardio}/100

**Schema:**
- Pass per vecka: ${profile.sessionsPerWeek}
- Passlängd: ${sessionDuration} minuter (MÅSTE efterföljas exakt ±10%)
- Träningsdagar: ${weekdayList}

**Tillgänglig utrustning:**
${equipmentList || "Endast kroppsvikt"}

**⚠️ KRITISK TIDSBERÄKNING (MÅSTE FÖLJAS EXAKT):**

VARJE pass MÅSTE ha en 'estimated_duration_minutes' som beräknas enligt denna formel:

1. **Standardtider:**
   - 1 set = 1.5 minuter (30 sekunder arbete + 60 sekunder vila)
   - Uppvärmning = EXAKT 10 minuter (FAST)
   - Nedvarvning = EXAKT 8 minuter (FAST)

2. **Matematisk formel för huvuddel:**
   - Tillgänglig tid för övningar = ${sessionDuration} - 10 (uppvärmning) - 8 (nedvarvning) = ${sessionDuration - 18} minuter
   - Antal set som ryms = ${sessionDuration - 18} min ÷ 1.5 min/set = ${Math.floor((sessionDuration - 18) / 1.5)} set

3. **Beräkna estimated_duration_minutes:**
   - Räkna totala set i main_work (summa av alla exercises.sets)
   - estimated_duration_minutes = (totala_set × 1.5) + 10 + 8
   - Exempel: 28 set → (28 × 1.5) + 18 = 60 minuter ✓

4. **Tolerans:**
   - MÅSTE vara inom ±10% av ${sessionDuration} min
   - Acceptabelt: ${Math.floor(sessionDuration * 0.9)}-${Math.ceil(sessionDuration * 1.1)} minuter
   - Om du hamnar utanför detta intervall, JUSTERA antalet set

**VOLYM-MÅL (baserat på tidsberäkning):**
- Sikta på ${exerciseRange} övningar per pass
- Varje övning ska ha ${setsPerExerciseRange} set
- Totala set per pass: ${totalSetRange} (justerat för ${sessionDuration} min passlängd)
- Denna volym säkerställer att estimated_duration_minutes = ${sessionDuration} min ±10%

**VIKTIGA PRINCIPER FÖR PROGRAMDESIGN:**
1. **Muskelgruppsfördelning:** Träna alla stora muskelgrupper så jämnt fördelat som möjligt över veckan
2. **48-timmarsregeln:** Minst 48 timmars vila innan samma muskelgrupp tränas igen
3. **Överlappning:** Undvik att träna samma muskelgrupp på närliggande träningsdagar
4. **Balans:** Se till att varje vecka totalt täcker alla huvudsakliga muskelgrupper (Bröst, Rygg, Ben, Axlar, Biceps, Triceps, Core)

**VECKODAGSSTRUKTUR FÖR ${sessionsCount} PASS/VECKA:**
${weekdays.map((day: string, i: number) => `- Pass ${i + 1}: ${day}`).join('\n')}

Generera ett träningsprogram med ${passesPerCycle} träningspass (${passNames.join(', ')}-program). Varje pass körs ${Math.ceil(profile.sessionsPerWeek / passesPerCycle)} gånger per vecka och cyklar sedan till nästa pass.

**PASS-STRUKTUR (VIKTIGT):**
- **${passesPerCycle} PASS: Pass ${passNames.join(', ')}**
- Användaren kommer att köra dessa pass i cykel: ${passNames.join(' → ')} → ${passNames[0]} → ...
- Varje pass bör träna olika muskelgrupper för optimal recovery
- En full cykel tar cirka ${cycleDurationWeeks} veckor

Returnera ENDAST ett giltigt JSON-objekt med denna struktur:

{
  "programName": "Programnamn baserat på primära mål",
  "duration": "${cycleDurationWeeks} weeks",
  "phases": [
    {
      "phaseName": "Vecka 1-2: Pass ${passNames[0]}-${passNames[Math.min(1, passesPerCycle - 1)]}",
      "weekRange": "1-2",
      "sessions": [
        {
          "sessionName": "Pass A - Överkropp",
          "muscleFocus": "Överkropp - Push",
          "sessionType": "strength",
          "weekday": "Måndag",
          "exercises": [
            {
              "exerciseKey": "barbell_bench_press",
              "exerciseTitle": "Bench Press",
              "sets": 4,
              "reps": "6-8",
              "restSeconds": 180,
              "notes": "Fokusera på kontrollerad nedåtgående fas",
              "equipment": ["Skivstång", "Bänk"],
              "muscleGroups": ["Bröst", "Triceps", "Axlar"]
            }
          ]
        }
      ]
    }
  ]
}

**KRITISKA REGLER FÖR ${passesPerCycle}-PASS PROGRAM:**
- Skapa EXAKT ${passesPerCycle} OLIKA PASS (${passNames.join(', ')})
- Varje pass är ett UNIKT träningspass med olika muskelgruppsfördelning
- Varje pass körs ${Math.ceil(profile.sessionsPerWeek / passesPerCycle)}-${Math.ceil(profile.sessionsPerWeek / Math.max(1, passesPerCycle - 1))} gånger per vecka beroende på användarens schema
- **MUSKELGRUPPSFÖRDELNING:** Varje pass måste fokusera på OLIKA muskelgrupper för optimal recovery:
  ${passesPerCycle === 2 ? '  • Pass A: Överkropp (Bröst, Rygg, Axlar)\n  • Pass B: Ben & Rumpa' : ''}
  ${passesPerCycle === 3 ? '  • Pass A: Push (Bröst, Axlar, Triceps)\n  • Pass B: Pull (Rygg, Biceps)\n  • Pass C: Ben & Rumpa' : ''}
  ${passesPerCycle >= 4 ? '  • Pass A: Överkropp Push\n  • Pass B: Överkropp Pull  \n  • Pass C: Ben & Rumpa\n  • Pass D: Specialisering/Svag punkt' : ''}
- Varje pass MÅSTE ha ett "weekday" fält (vid behov, kan användaren anpassa)
- Sikta på ${exerciseRange} övningar med ${setsPerExerciseRange} set vardera (totalt: ${totalSetRange} set per pass)
- Denna volym är designad för att fylla ${sessionDuration}-minuters passlängden
- Använd ENDAST övningar med tillgänglig utrustning: ${equipmentList || "kroppsvikt"}
- Varje övning MÅSTE ha "equipment" array (använd exakta namn) och "muscleGroups" array
- Inkludera 2 faser för att visa hela cykelns progression
- **KRITISKT**: Använd ENDAST ENGELSKA namn för alla övningar
- Svara ENDAST med giltig JSON, INGA förklaringar`;
}

/**
 * Build reasoner-optimized system prompt for DeepSeek Reasoner
 * Designed for structured JSON with warmup/cooldown blocks
 */
export function buildReasonerSystemPromptV1(): string {
  return `Du är en expert-tränare som genererar personliga träningsprogram.

Din expertis:
- Träningsperiodisering och progression
- Tidsoptimerad programdesign
- Balanserad muskelgruppsfördelning med 48h återhämtning
- Anpassning efter utrustning och träningsmål

Primära regler:
1. Skapa säkra, effektiva träningsprogram baserade på användarens mål och tillgänglig utrustning
2. Optimera volym och intensitet efter målprioriteringar (styrka, volym, uthållighet, kondition)
3. Följ tidskrav exakt (±10% tolerans av målad passlängd)
4. Använd endast ENGELSKA övningsnamn (t.ex. "Bench Press", "Squat")
5. Svara ENDAST med giltig JSON (ingen markdown, inga förklaringar)

Output-struktur: Du får specifika instruktioner om JSON-strukturen i user-meddelandet.`;
}

/**
 * Build reasoner-optimized user prompt with warmup/cooldown structure
 */
export function buildReasonerUserPromptV1(
  profile: {
    age?: number;
    sex?: string;
    bodyWeight?: number;
    height?: number;
    trainingLevel?: string;
    goalStrength: number;
    goalVolume: number;
    goalEndurance: number;
    goalCardio: number;
    sessionsPerWeek: number;
  },
  sessionDuration: number,
  weekdayList: string,
  equipmentList: string
): string {
  const passesPerCycle = calculatePassesPerCycle(profile.sessionsPerWeek);
  const passNames = ['A', 'B', 'C', 'D'].slice(0, passesPerCycle);
  // Calculate distribution percentages
  const total = profile.goalStrength + profile.goalVolume + profile.goalEndurance + profile.goalCardio;
  const distribution = {
    strength_percent: total > 0 ? Math.round((profile.goalStrength / total) * 100) : 25,
    hypertrophy_percent: total > 0 ? Math.round((profile.goalVolume / total) * 100) : 25,
    endurance_percent: total > 0 ? Math.round((profile.goalEndurance / total) * 100) : 25,
    cardio_percent: total > 0 ? Math.round((profile.goalCardio / total) * 100) : 25,
  };

  return `Generera ett veckoträningsprogram baserat på följande användardata:

**ANVÄNDARPROFIL:**
- Ålder: ${profile.age || 'Ej angiven'}
- Kön: ${profile.sex || 'Ej angiven'}
- Kroppsvikt: ${profile.bodyWeight || 'Ej angiven'} kg
- Längd: ${profile.height || 'Ej angiven'} cm
- Träningsnivå: ${profile.trainingLevel || 'Mellannivå'}

**TRÄNINGSMÅL (DISTRIBUTION):**
- Styrka: ${distribution.strength_percent}%
- Hypertrofi: ${distribution.hypertrophy_percent}%
- Uthållighet: ${distribution.endurance_percent}%
- Kondition: ${distribution.cardio_percent}%

**SCHEMA:**
- Pass per vecka: ${profile.sessionsPerWeek}
- Passlängd: ${sessionDuration} minuter
- Acceptabel längd per pass: ${Math.floor(sessionDuration * 0.9)}-${Math.ceil(sessionDuration * 1.1)} minuter (±10%)
- Träningsdagar: ${weekdayList}

**TILLGÄNGLIG UTRUSTNING:**
${equipmentList || "Endast kroppsvikt"}

**OUTPUT-FORMAT (OBLIGATORISKT):**

Svara med ett JSON-objekt enligt denna exakta struktur:

{
  "user_profile": {
    "gender": "${profile.sex || 'Annat'}",
    "age": ${profile.age || 30},
    "weight_kg": ${profile.bodyWeight || 70},
    "height_cm": ${profile.height || 170},
    "training_level": "${profile.trainingLevel || 'Mellannivå'}",
    "main_goal": "Baserat på högsta målprocent",
    "distribution": {
      "strength_percent": ${distribution.strength_percent},
      "hypertrophy_percent": ${distribution.hypertrophy_percent},
      "endurance_percent": ${distribution.endurance_percent},
      "cardio_percent": ${distribution.cardio_percent}
    },
    "sessions_per_week": ${profile.sessionsPerWeek},
    "session_length_minutes": ${sessionDuration},
    "available_equipment": ${JSON.stringify(equipmentList?.split(', ').filter(Boolean) || [])}
  },
  "program_overview": {
    "week_focus_summary": "Kort sammanfattning av veckans fokus",
    "expected_difficulty": "Lättare/Medel/Svårare",
    "notes_on_progression": "Hur användaren ska progressa"
  },
  "weekly_sessions": [
    {
      "session_number": 1,
      "weekday": "En dag från listan",
      "session_name": "Namn på passet",
      "muscle_focus": "Kort namn baserat på muskelgrupper" (t.ex. "Överkropp - Push", "Ben & Rumpa", "Rygg & Biceps", "Helkropp", "Core & Kondition"),
      "session_type": "strength/hypertrophy/endurance/cardio",
      "estimated_duration_minutes": ${sessionDuration},
      "warmup": [
        {
          "exercise_name": "Uppvärmningsövning",
          "sets": 1,
          "reps_or_duration": "5 min",
          "notes": "Förklaring"
        }
      ],
      "main_work": [
        {
          "exercise_name": "ENGELSKA namnet",
          "sets": 3,
          "reps": "8-12",
          "rest_seconds": 90,
          "tempo": "2-0-1-0",
          "suggested_weight_kg": null,
          "suggested_weight_notes": "Förslag på intensitet",
          "target_muscles": ["Muskelgrupp1", "Muskelgrupp2"],
          "required_equipment": ["Utrustning1"],
          "technique_cues": ["Teknikinstruktion1", "Teknikinstruktion2"]
        }
      ],
      "cooldown": [
        {
          "exercise_name": "Nedvarvningsövning",
          "duration_or_reps": "5 min",
          "notes": "Förklaring"
        }
      ]
    }
  ],
  "recovery_tips": ["Tips 1", "Tips 2"]
}

**VIKTIGA KRAV:**
1. Skapa EXAKT ${passesPerCycle} OLIKA PASS (${passNames.join(', ')}) - inte en per session, utan UNIKA pass som cyklas
2. Varje pass måste ha "estimated_duration_minutes" inom ±10% av ${sessionDuration} min
3. Använd ENDAST övningar med tillgänglig utrustning: ${equipmentList || "kroppsvikt"}
4. Alla övningsnamn MÅSTE vara på ENGELSKA
5. Fördela muskelgrupper så att samma grupp inte tränas med < 48h mellanrum
6. Varje pass bör fokusera på OLIKA muskelgrupper för optimal recovery mellan pass
7. Svara ENDAST med JSON (ingen markdown, inga förklaringar)`;
}
