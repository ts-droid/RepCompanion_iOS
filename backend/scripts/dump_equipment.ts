
import { db } from "../server/db";
import { equipmentCatalog } from "../server/db/schema";

async function dumpEquipment() {
  const items = await db.select().from(equipmentCatalog);
  console.log(JSON.stringify(items, null, 2));
  process.exit(0);
}

dumpEquipment();
