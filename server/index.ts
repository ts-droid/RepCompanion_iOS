import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  
  // Log ALL incoming requests to /api/onboarding/complete immediately
  if (path === "/api/onboarding/complete" || req.originalUrl?.includes("/api/onboarding/complete")) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[MIDDLEWARE] 📥 INCOMING REQUEST DETECTED");
    console.log("[MIDDLEWARE] 📋 Method:", req.method);
    console.log("[MIDDLEWARE] 🌐 Path:", path);
    console.log("[MIDDLEWARE] 🌐 Original URL:", req.originalUrl);
    console.log("[MIDDLEWARE] 📋 Headers:", JSON.stringify(req.headers, null, 2));
    console.log("[MIDDLEWARE] 📦 Body type:", typeof req.body);
    console.log("[MIDDLEWARE] 📦 Body:", JSON.stringify(req.body || {}, null, 2));
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }
  
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Track server start time and process info
const SERVER_START_TIME = Date.now();
const SERVER_PID = process.pid;

// Make SERVER_START_TIME available globally for health check
(global as any).SERVER_START_TIME = SERVER_START_TIME;

// Uncaught exception handler
process.on('uncaughtException', (error: Error) => {
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("[SERVER] ❌ UNCAUGHT EXCEPTION - Server will continue running");
  console.error("[SERVER] Error Name:", error.name);
  console.error("[SERVER] Error Message:", error.message);
  console.error("[SERVER] Error Stack:", error.stack);
  if ((error as any).code) {
    console.error("[SERVER] Error Code:", (error as any).code);
  }
  if ((error as any).cause) {
    console.error("[SERVER] Error Cause:", (error as any).cause);
  }
  console.error("[SERVER] Full Error Object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  // Don't exit - let the process continue
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.error("[SERVER] ❌ UNHANDLED REJECTION - Server will continue running");
  console.error("[SERVER] Reason Type:", typeof reason);
  console.error("[SERVER] Reason:", reason);
  if (reason instanceof Error) {
    console.error("[SERVER] Error Name:", reason.name);
    console.error("[SERVER] Error Message:", reason.message);
    console.error("[SERVER] Error Stack:", reason.stack);
  } else if (typeof reason === 'object' && reason !== null) {
    console.error("[SERVER] Reason Object:", JSON.stringify(reason, Object.getOwnPropertyNames(reason), 2));
  }
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  // Don't exit - let the process continue
});

(async () => {
  // Log V3 configuration
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[SERVER] 🚀 RepCompanion Server Starting");
  console.log("[SERVER] 📋 Process Info:");
  console.log(`  • PID: ${SERVER_PID}`);
  console.log(`  • Node Version: ${process.version}`);
  console.log(`  • Platform: ${process.platform}`);
  console.log(`  • Start Time: ${new Date(SERVER_START_TIME).toISOString()}`);
  console.log("[SERVER] 📋 AI Configuration:");
  console.log("  • AI Version: V3 (consolidated)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  // Auto-seed equipment catalog if database is empty
  try {
    const { db } = await import("./db");
    const { equipmentCatalog } = await import("@shared/schema");
    const { seedEquipment } = await import("./seed");
    
    const existingEquipment = await db.select().from(equipmentCatalog).limit(1);
    if (existingEquipment.length === 0) {
      console.log("[SERVER] 🌱 Database is empty, seeding equipment catalog...");
      await seedEquipment();
      console.log("[SERVER] ✅ Equipment catalog seeded successfully");
    } else {
      console.log("[SERVER] ✅ Equipment catalog already has data");
    }
  } catch (error) {
    console.error("[SERVER] ⚠️  Warning: Could not auto-seed equipment catalog:", error);
    // Don't fail server startup if seeding fails
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Default to 5001 to match iOS app configuration (iOS expects localhost:5001)
  // this serves both the API and the client.
  const port = parseInt(process.env.PORT || '5001', 10);
  
  // Start heartbeat logging
  const heartbeatInterval = setInterval(() => {
    const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
    const memoryUsage = process.memoryUsage();
    console.log(`[SERVER] 💓 Heartbeat - Uptime: ${uptime}s, PID: ${SERVER_PID}, Memory: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
  }, 30000); // Every 30 seconds

  // Start periodic cache promotion task (runs every hour)
  // TODO: Implement promoteEligibleProgramsToGlobal in storage.ts
  // Automatically promotes per-user programs to global cache after 48 hours
  const cachePromotionInterval: ReturnType<typeof setInterval> | undefined = undefined;
  /* DISABLED - promoteEligibleProgramsToGlobal not yet implemented
  const cachePromotionInterval = setInterval(async () => {
    try {
      console.log(`[CACHE] 🔄 Running periodic cache promotion check...`);
      const promotedCount = await storage.promoteEligibleProgramsToGlobal(48);
      if (promotedCount > 0) {
        console.log(`[CACHE] ✅ Promoted ${promotedCount} programs to global cache`);
      }
    } catch (error: any) {
      console.error(`[CACHE] ❌ Error in periodic cache promotion:`, error?.message);
    }
  }, 3600000); // Every hour (3600000ms)
  */

  // Run cache promotion immediately on startup (to catch any programs that became eligible while server was down)
  /* DISABLED - promoteEligibleProgramsToGlobal not yet implemented
  setTimeout(async () => {
    try {
      console.log(`[CACHE] 🔄 Running initial cache promotion check on startup...`);
      const promotedCount = await storage.promoteEligibleProgramsToGlobal(48);
      if (promotedCount > 0) {
        console.log(`[CACHE] ✅ Promoted ${promotedCount} programs to global cache on startup`);
      }
    } catch (error: any) {
      console.error(`[CACHE] ❌ Error in initial cache promotion:`, error?.message);
    }
  }, 10000); // Wait 10 seconds after server start to ensure database is ready
  */
  
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    console.log(`[SERVER] ✅ Server started successfully on port ${port}`);
    console.log(`[SERVER] 📊 Process PID: ${SERVER_PID}`);
    console.log(`[SERVER] 💓 Heartbeat monitoring started (every 30s)`);
  });
  
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[SERVER] ❌ Port ${port} is already in use`);
      console.error(`[SERVER] Please stop the process using port ${port} or set PORT environment variable to a different port`);
      console.error(`[SERVER] Error details:`, error);
    } else {
      console.error(`[SERVER] ❌ Server error:`, error);
    }
  });
  
  // Cleanup on exit
  process.on('SIGTERM', () => {
    console.log("[SERVER] ⚠️  SIGTERM received, shutting down gracefully...");
    clearInterval(heartbeatInterval);
    clearInterval(cachePromotionInterval);
    server.close(() => {
      console.log("[SERVER] ✅ Server closed");
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log("[SERVER] ⚠️  SIGINT received, shutting down gracefully...");
    clearInterval(heartbeatInterval);
    clearInterval(cachePromotionInterval);
    server.close(() => {
      console.log("[SERVER] ✅ Server closed");
      process.exit(0);
    });
  });
})();
