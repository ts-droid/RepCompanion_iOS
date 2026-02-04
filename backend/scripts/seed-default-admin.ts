import { db } from "../server/db";
import { adminUsers } from "../shared/schema";
import { hashPassword } from "../server/adminUserAuth";
import { eq } from "drizzle-orm";

/**
 * Seed default super admin user
 * Email: thomas@recompute.it
 * Password: qwerty123456 (must be changed on first login)
 */

async function seedDefaultAdmin() {
  try {
    const defaultEmail = "thomas@recompute.it";
    const defaultPassword = "qwerty123456";
    
    console.log("[SEED-ADMIN] Checking if default admin exists...");
    
    // Check if admin already exists
    const [existing] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, defaultEmail));
    
    if (existing) {
      console.log(`[SEED-ADMIN] ✅ Admin user ${defaultEmail} already exists`);
      console.log(`[SEED-ADMIN] Super Admin: ${existing.isSuperAdmin}`);
      console.log(`[SEED-ADMIN] 2FA Enabled: ${existing.totpEnabled}`);
      return;
    }
    
    console.log("[SEED-ADMIN] Creating default admin user...");
    
    // Hash default password
    const passwordHash = await hashPassword(defaultPassword);
    
    // Create super admin user
    const [admin] = await db
      .insert(adminUsers)
      .values({
        email: defaultEmail,
        passwordHash,
        forcePasswordChange: true, // Must change password on first login
        isSuperAdmin: true, // Super admin can create other admins
        totpEnabled: false, // Will setup 2FA on first login
      })
      .returning();
    
    console.log("[SEED-ADMIN] ✅ Default admin user created successfully!");
    console.log(`[SEED-ADMIN] Email: ${admin.email}`);
    console.log(`[SEED-ADMIN] Password: ${defaultPassword} (change required)`);
    console.log(`[SEED-ADMIN] Super Admin: ${admin.isSuperAdmin}`);
    console.log(`[SEED-ADMIN] Created: ${admin.createdAt}`);
    console.log("\n🔐 FIRST LOGIN STEPS:");
    console.log("1. Login with email/password");
    console.log("2. Change password (min 12 chars, upper+lower+number+special)");
    console.log("3. Scan QR code with Google Authenticator");
    console.log("4. Enter 6-digit code to enable 2FA");
    console.log("5. Access admin dashboard");
    
  } catch (error) {
    console.error("[SEED-ADMIN] Error:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

seedDefaultAdmin();
