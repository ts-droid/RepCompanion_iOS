import fs from "fs";
import { eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../server/db";
import { equipmentCatalog, exercises } from "../shared/schema";

type CliOptions = {
  apply: boolean;
  limit: number;
  reportPath: string;
};

type V4Exercise = {
  id: string;
  name: string;
  category?: string;
  equipment?: string;
};

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const reportArg = args.find((arg) => arg.startsWith("--report="));
  const parsedLimit = limitArg ? Number(limitArg.split("=")[1]) : 2000;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 2000;
  const reportPath = reportArg?.split("=")[1] || "/tmp/normalize-exercise-metadata-report.json";
  return { apply, limit, reportPath };
}

function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalize(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9åäö\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitEquipment(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[,+/&]| and /i)
    .map((part) => normalize(part))
    .filter(Boolean);
}

const EQUIPMENT_SYNONYMS: Record<string, string> = {
  dumbbell: "dumbbells",
  dumbbells: "dumbbells",
  hantel: "dumbbells",
  hantlar: "dumbbells",
  barbell: "barbell",
  skivstang: "barbell",
  skivstång: "barbell",
  cable: "cable_machine",
  cables: "cable_machine",
  kabel: "cable_machine",
  kabelmaskin: "cable_machine",
  machine: "machine",
  maskin: "machine",
  bench: "flat_bench",
  bank: "flat_bench",
  bänk: "flat_bench",
  rack: "power_rack",
  power_rack: "power_rack",
  smith_machine: "smith_machine",
  bodyweight: "bodyweight",
  kroppsvikt: "bodyweight",
  kettlebell: "kettlebells",
  kettlebells: "kettlebells",
  band: "resistance_bands",
  resistance_band: "resistance_bands",
  resistance_bands: "resistance_bands",
};

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function run() {
  const { apply, limit, reportPath } = parseArgs();
  console.log(`[NORMALIZE] Mode=${apply ? "APPLY" : "DRY-RUN"} limit=${limit}`);

  const rawV4 = JSON.parse(
    fs.readFileSync("server/data/exercises.json", "utf8"),
  ) as V4Exercise[];

  const byId = new Map<string, V4Exercise>();
  const byName = new Map<string, V4Exercise>();
  for (const row of rawV4) {
    byId.set(row.id, row);
    byName.set(normalize(row.name), row);
  }

  // 1) Ensure equipment keys exist for equipment catalog.
  const allEquipment = await db.select().from(equipmentCatalog);
  let equipmentKeysFilled = 0;
  for (const eqRow of allEquipment) {
    const current = (eqRow.equipmentKey || "").trim();
    if (current) continue;
    const generated = slugify(eqRow.nameEn || eqRow.name || "");
    if (!generated) continue;

    if (apply) {
      await db
        .update(equipmentCatalog)
        .set({ equipmentKey: generated })
        .where(eq(equipmentCatalog.id, eqRow.id));
    }
    equipmentKeysFilled += 1;
  }
  console.log(`[NORMALIZE] equipment_key filled: ${equipmentKeysFilled}`);

  const refreshedEquipment = await db.select().from(equipmentCatalog);
  const equipmentMap = new Map<string, string>();
  for (const eqRow of refreshedEquipment) {
    const key = (eqRow.equipmentKey || "").trim();
    if (!key) continue;
    equipmentMap.set(normalize(key), key);
    equipmentMap.set(normalize(eqRow.name || ""), key);
    equipmentMap.set(normalize(eqRow.nameEn || ""), key);
  }
  for (const [token, key] of Object.entries(EQUIPMENT_SYNONYMS)) {
    equipmentMap.set(normalize(token), key);
  }

  // 2) Normalize exercises using V4 catalog.
  const allExercises = await db.select().from(exercises).limit(limit);
  let categoryUpdated = 0;
  let equipmentUpdated = 0;
  let nameEnUpdated = 0;
  const unresolvedEquipment: Array<{ id: string; name: string; tokens: string[] }> = [];

  for (const ex of allExercises) {
    const match =
      (ex.exerciseId && byId.get(ex.exerciseId)) ||
      byName.get(normalize(ex.nameEn || ex.name || ""));
    if (!match) continue;

    const updates: Partial<typeof exercises.$inferInsert> = {};

    // Category: replace generic/legacy categories with V4 category.
    if (
      match.category &&
      (!ex.category ||
        ["strength", "unknown", "other"].includes(ex.category.toLowerCase()))
    ) {
      updates.category = match.category;
      categoryUpdated += 1;
    }
    if (ex.category === "strength" && !updates.category) {
      updates.category = "Strength";
      categoryUpdated += 1;
    }

    // English name backfill.
    if (!ex.nameEn && match.name) {
      updates.nameEn = match.name;
      nameEnUpdated += 1;
    }

    // Equipment: replace unknown with mapped equipment keys.
    const currentEqTokensRaw = (ex.requiredEquipment || []).map((item) => normalize(item));
    const mappedCurrent = currentEqTokensRaw
      .map((token) => equipmentMap.get(token))
      .filter((value): value is string => Boolean(value));

    let nextEquipment = Array.from(new Set(mappedCurrent));
    if (nextEquipment.length === 0 && match?.equipment) {
      const fromV4 = splitEquipment(match.equipment)
        .map((token) => equipmentMap.get(token))
        .filter((value): value is string => Boolean(value));
      nextEquipment = Array.from(new Set(fromV4));
    }
    if (nextEquipment.length === 0) {
      nextEquipment = ["bodyweight"];
    }

    const originalCanonical = Array.from(
      new Set((ex.requiredEquipment || []).map((token) => equipmentMap.get(normalize(token)) || token))
    );
    if (!arraysEqual(originalCanonical, nextEquipment)) {
      updates.requiredEquipment = nextEquipment;
      equipmentUpdated += 1;
    }

    const unresolved = (ex.requiredEquipment || [])
      .map((token) => normalize(token))
      .filter((token) => token && !equipmentMap.get(token));
    if (unresolved.length > 0) {
      unresolvedEquipment.push({
        id: ex.id,
        name: ex.nameEn || ex.name,
        tokens: Array.from(new Set(unresolved)),
      });
    }

    if (Object.keys(updates).length > 0 && apply) {
      await db.update(exercises).set(updates).where(eq(exercises.id, ex.id));
    }
  }

  const [missingEqAfter] = await db
    .select({ count: sql<number>`count(*)` })
    .from(exercises)
    .where(
      or(
        isNull(exercises.requiredEquipment),
        sql`cardinality(${exercises.requiredEquipment}) = 0`,
        sql`${exercises.requiredEquipment} @> ARRAY['unknown']::text[]`,
      ),
    );

  const [strengthCountAfter] = await db
    .select({ count: sql<number>`count(*)` })
    .from(exercises)
    .where(eq(exercises.category, "strength"));

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "APPLY" : "DRY-RUN",
    unresolvedEquipmentCount: unresolvedEquipment.length,
    unresolvedEquipment,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\n[NORMALIZE] Summary");
  console.log(`- category updates: ${categoryUpdated}`);
  console.log(`- requiredEquipment updates: ${equipmentUpdated}`);
  console.log(`- nameEn updates: ${nameEnUpdated}`);
  console.log(`- missing/unknown equipment after: ${Number(missingEqAfter?.count || 0)}`);
  console.log(`- category=strength after: ${Number(strengthCountAfter?.count || 0)}`);
  console.log(`- unresolved equipment rows: ${unresolvedEquipment.length}`);
  console.log(`- report: ${reportPath}`);
  console.log(`- mode: ${apply ? "APPLY" : "DRY-RUN"}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[NORMALIZE] Fatal:", error);
    process.exit(1);
  });
