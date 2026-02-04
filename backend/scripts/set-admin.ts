import { db } from "../server/db";
import { userProfiles } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Script to set a user as admin
 * Usage: npm run tsx scripts/set-admin.ts <userId>
 */

const userId = process.argv[2];

if (!userId) {
  console.error("Usage: npm run tsx scripts/set-admin.ts <userId>");
  console.error("\nExample: npm run tsx scripts/set-admin.ts 000134.d4586703b7f240d7b8652c9608f6f56b.1127");
  process.exit(1);
}

async function setAdmin() {
  try {
    console.log(`[SET-ADMIN] Setting admin status for user: ${userId}`);
    
    const result = await db
      .update(userProfiles)
      .set({
        isAdmin: true,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId))
      .returning();

    if (result.length === 0) {
      console.error(`[SET-ADMIN] ❌ User not found: ${userId}`);
      process.exit(1);
    }

    console.log(`[SET-ADMIN] ✅ User ${userId} is now an admin!`);
    console.log(`[SET-ADMIN] Admin status: ${result[0].isAdmin}`);
    process.exit(0);
  } catch (error) {
    console.error("[SET-ADMIN] Error:", error);
    process.exit(1);
  }
}

setAdmin();
