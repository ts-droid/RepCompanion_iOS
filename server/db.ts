import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.error("[DB] ❌ DATABASE_URL is not set!");
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

console.log("[DB] 🔧 Initializing database connection...");
console.log("[DB] 📋 DATABASE_URL present:", process.env.DATABASE_URL ? "✅ Yes" : "❌ No");
console.log("[DB] 📋 DATABASE_URL length:", process.env.DATABASE_URL?.length || 0);
console.log("[DB] 📋 DATABASE_URL starts with:", process.env.DATABASE_URL?.substring(0, 20) || "N/A");

let sql;
try {
  sql = neon(process.env.DATABASE_URL);
  console.log("[DB] ✅ Neon client created successfully");
} catch (error) {
  console.error("[DB] ❌ Failed to create Neon client:", error);
  throw error;
}

let db;
try {
  db = drizzle(sql, { schema });
  console.log("[DB] ✅ Drizzle ORM initialized successfully");
} catch (error) {
  console.error("[DB] ❌ Failed to initialize Drizzle:", error);
  throw error;
}

// Test database connection on startup
(async () => {
  try {
    console.log("[DB] 🔍 Testing database connection...");
    const testResult = await sql`SELECT 1 as test`;
    console.log("[DB] ✅ Database connection test successful:", testResult);
  } catch (error: any) {
    console.error("[DB] ❌ Database connection test failed:");
    console.error("[DB] Error type:", typeof error);
    console.error("[DB] Error message:", error?.message);
    console.error("[DB] Error stack:", error?.stack);
    if (error?.code) {
      console.error("[DB] Error code:", error.code);
    }
    if (error?.cause) {
      console.error("[DB] Error cause:", error.cause);
    }
    // Don't throw - let the server start and log errors when actually used
  }
})();

export { db };
