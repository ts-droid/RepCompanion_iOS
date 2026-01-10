import 'dotenv/config';
import { db } from "./server/db";
import { equipmentCatalog } from "./shared-ts/schema";
import { sql } from "drizzle-orm";

async function main() {
  try {
    const result = await db.select().from(equipmentCatalog).limit(1);
    if (result.length > 0) {
      console.log("EQUIPMENT_ID:" + result[0].id);
    } else {
      console.log("NO_EQUIPMENT_FOUND");
    }
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

main();
