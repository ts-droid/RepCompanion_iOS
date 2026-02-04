
import { db } from "../server/db";
import { userProfiles } from "../shared/schema";
import { eq } from "drizzle-orm";

async function checkProfile() {
  const userId = "000134.d4586703b7f240d7b8652c9608f6f56b.1127";
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
  
  if (!profile) {
    console.log("No profile found for user:", userId);
  } else {
    console.log("Found profile:");
    console.log(JSON.stringify(profile, null, 2));
  }
  process.exit(0);
}

checkProfile().catch(console.error);
