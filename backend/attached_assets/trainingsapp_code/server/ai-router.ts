import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL || "https://forge.manus.im";
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

interface ForgeMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ForgeRequest {
  model: string;
  messages: ForgeMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface ForgeResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function callForgeAPI(messages: ForgeMessage[]): Promise<string> {
  const response = await fetch(`${FORGE_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      temperature: 0.7,
      max_tokens: 3000,
    } as ForgeRequest),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Forge API error: ${response.status} - ${error}`);
  }

  const data: ForgeResponse = await response.json();
  return data.choices[0]?.message?.content || "";
}

export const aiRouter = router({
  generateWorkoutProgram: protectedProcedure
    .input(
      z.object({
        age: z.number(),
        sex: z.string(),
        bodyWeight: z.number(),
        height: z.number(),
        bodyFatPercent: z.number().optional(),
        muscleMassPercent: z.number().optional(),
        sessionsPerWeek: z.number(),
        sessionDuration: z.number(),
        goalVolume: z.number(),
        goalStrength: z.number(),
        goalCardio: z.number(),
        oneRmBench: z.number().optional(),
        oneRmOhp: z.number().optional(),
        oneRmDeadlift: z.number().optional(),
        oneRmLatpull: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const bmi = input.bodyWeight / Math.pow(input.height / 100, 2);

      const systemPrompt = `Du är en professionell personlig tränare och träningsprogramdesigner. Din uppgift är att skapa ett detaljerat, vetenskapligt baserat träningsprogram anpassat efter användarens mål och förutsättningar.

Svara ALLTID på svenska och strukturera programmet enligt följande JSON-format:

{
  "programName": "Namn på programmet",
  "description": "Kort beskrivning av programmet",
  "duration": "Programlängd (t.ex. '8 veckor')",
  "sessions": [
    {
      "id": "A",
      "name": "Pass A - Namn",
      "blurb": "Kort beskrivning",
      "exercises": [
        {
          "title": "Övningsnamn",
          "prescription": "3×8-12",
          "notes": "Viktiga tips"
        }
      ],
      "estMinutes": "45-50 min"
    }
  ],
  "nutritionTips": "Näringsråd baserat på mål",
  "progressionPlan": "Hur man progressar i programmet"
}

Basera programmet på:
- Användarens träningsmål (volym/styrka/kondition)
- Antal pass per vecka
- Tillgänglig tid per pass
- Nuvarande styrkenivå (1RM-värden om tillgängliga)
- Ålder och kön för återhämtning

Inkludera:
- Uppvärmning för varje pass
- Huvudövningar (compound movements)
- Accessoriska övningar
- Finisher/kondition om relevant
- Progressionsschema
- Näringsråd`;

      const userPrompt = `Skapa ett träningsprogram för mig baserat på följande information:

**Personliga data:**
- Ålder: ${input.age} år
- Kön: ${input.sex === "male" ? "Man" : input.sex === "female" ? "Kvinna" : "Annat"}
- Vikt: ${input.bodyWeight} kg
- Längd: ${input.height} cm
- BMI: ${bmi.toFixed(1)}
${input.bodyFatPercent ? `- Kroppsfett: ${input.bodyFatPercent}%` : ""}
${input.muscleMassPercent ? `- Muskelmassa: ${input.muscleMassPercent}%` : ""}

**Träningsmål (fördelning):**
- Volym/Muskeltillväxt: ${input.goalVolume}%
- Styrka: ${input.goalStrength}%
- Kondition: ${input.goalCardio}%

**Träningsschema:**
- Antal pass per vecka: ${input.sessionsPerWeek}
- Tid per pass: ${input.sessionDuration} minuter

**Nuvarande styrkenivå (1RM):**
${input.oneRmBench ? `- Bänkpress: ${input.oneRmBench} kg` : ""}
${input.oneRmOhp ? `- Militärpress: ${input.oneRmOhp} kg` : ""}
${input.oneRmDeadlift ? `- Marklyft: ${input.oneRmDeadlift} kg` : ""}
${input.oneRmLatpull ? `- Latdrag: ${input.oneRmLatpull} kg` : ""}

Skapa ett komplett träningsprogram som passar mina mål och förutsättningar. Svara ENDAST med JSON-formatet, ingen annan text.`;

      const messages: ForgeMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      try {
        const aiResponse = await callForgeAPI(messages);
        
        // Extract JSON from response - try multiple strategies
        let jsonStr = aiResponse.trim();
        
        // Strategy 1: Find JSON between code blocks
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1].trim();
        }
        
        // Strategy 2: Find first { to last }
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }
        
        // Clean up common JSON issues
        jsonStr = jsonStr
          .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
          .replace(/([{,]\s*)([a-zA-Z0-9_]+):/g, '$1"$2":') // Quote unquoted keys
          .replace(/\n/g, ' ') // Remove newlines
          .replace(/\s+/g, ' '); // Normalize whitespace
        
        if (!jsonStr || jsonStr.length < 10) {
          throw new Error("AI svarade inte med giltigt JSON-format");
        }

        const program = JSON.parse(jsonStr);
        
        return {
          success: true,
          program,
          rawResponse: aiResponse,
        };
      } catch (error) {
        console.error("AI generation error:", error);
        throw new Error(
          `Kunde inte generera träningsprogram: ${error instanceof Error ? error.message : "Okänt fel"}`
        );
      }
    }),
});
