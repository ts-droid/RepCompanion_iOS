import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { isAuthenticatedOrDev, ensureDevUserExists } from "./devAuth";
import { insertUserProfileSchema, updateUserProfileSchema, insertGymSchema, updateGymSchema, insertEquipmentSchema, insertWorkoutSessionSchema, insertExerciseLogSchema, updateExerciseLogSchema, suggestAlternativeRequestSchema, suggestAlternativeResponseSchema, trackPromoImpressionSchema, trackAffiliateClickSchema, insertNotificationPreferencesSchema, promoIdParamSchema, promoPlacementParamSchema, generateProgramRequestSchema, exercises, exerciseLogs, workoutSessions, programTemplateExercises, equipmentCatalog, unmappedExercises, unmappedEquipment, exerciseAliases, equipmentAliases, type ExerciseLog } from "@shared/schema";
import { z, ZodError } from "zod";
import { analyzeUserProfile, createWorkoutProgram, mapOnboardingToV3Profile } from "./ai-service-v3";
import { generateV3Program } from "./v3-program-generator";
import { recognizeEquipmentFromImage } from "./roboflow-service";
import { promoService } from "./promo-service";
import { workoutGenerationService } from "./workout-generation-service";
import { vitalService } from "./vital-service";
import { db } from "./db";
import { eq, sql, and, gte, lte, desc } from "drizzle-orm";
import { healthConnections, healthMetrics } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // ========== HEALTH CHECK ==========
  
  // Basic health check endpoint (no auth required)
  app.get("/api/health", async (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const serverStartTime = (global as any).SERVER_START_TIME || Date.now();
    
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      serverStartTime: new Date(serverStartTime).toISOString(),
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
      },
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
      },
      aiVersion: "v3", // Consolidated to V3 only
    });
  });

  // ========== AUTH ROUTES ==========
  
  // ========== AUTH ROUTES ==========
  
  app.get("/api/auth/user", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ========== APPLE SIGN-IN ==========
  
  app.post("/api/auth/apple", async (req, res) => {
    try {
      const { idToken, authorizationCode } = req.body;

      if (!idToken) {
        return res.status(400).json({ message: "idToken is required" });
      }

      // Import auth helpers dynamically to avoid errors if packages aren't installed
      const { verifyAppleToken, createSessionToken } = await import('./auth-helpers');

      // Verify Apple ID token
      const decoded = await verifyAppleToken(idToken) as any;
      
      const appleUserId = decoded.sub;
      const email = decoded.email;
      const emailVerified = decoded.email_verified === 'true' || decoded.email_verified === true;
      
      // Create user identifier
      const userId = `apple_${appleUserId}`;
      
      // Extract name from Apple token if available (first time only)
      // Note: Apple only provides name on first sign-in
      let firstName: string | null = null;
      let lastName: string | null = null;
      
      // Create or update user
      const user = await storage.upsertUser({
        id: userId,
        email: email || null,
        firstName: firstName,
        lastName: lastName
      });
      
      // Create session token
      const sessionToken = createSessionToken(userId);
      
      res.json({
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.firstName || null
        }
      });
    } catch (error: any) {
      console.error("Apple auth error:", error);
      res.status(401).json({ 
        message: "Invalid Apple ID token",
        error: error.message 
      });
    }
  });

  // ========== GOOGLE SIGN-IN ==========
  
  app.post("/api/auth/google", async (req, res) => {
    try {
      const { idToken, accessToken } = req.body;

      if (!idToken) {
        return res.status(400).json({ message: "idToken is required" });
      }

      // Import auth helpers dynamically to avoid errors if packages aren't installed
      const { verifyGoogleToken, createSessionToken } = await import('./auth-helpers');

      // Verify Google ID token
      const payload = await verifyGoogleToken(idToken);
      
      if (!payload) {
        return res.status(401).json({ message: "Invalid Google token" });
      }
      
      const googleUserId = payload.sub;
      const email = payload.email;
      const name = payload.name;
      const picture = payload.picture;
      
      // Create user identifier
      const userId = `google_${googleUserId}`;
      
      // Split name into first and last name
      let firstName: string | null = null;
      let lastName: string | null = null;
      if (name) {
        const nameParts = name.split(' ');
        firstName = nameParts[0] || null;
        lastName = nameParts.slice(1).join(' ') || null;
      }
      
      // Create or update user
      const user = await storage.upsertUser({
        id: userId,
        email: email || null,
        firstName: firstName,
        lastName: lastName,
        profileImageUrl: picture || null
      });
      
      // Create session token
      const sessionToken = createSessionToken(userId);
      
      res.json({
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.firstName || null
        }
      });
    } catch (error: any) {
      console.error("Google auth error:", error);
      res.status(401).json({ 
        message: "Invalid Google ID token",
        error: error.message 
      });
    }
  });

  // ========== EMAIL/PASSWORD AUTH (Development Only) ==========
  
  // Simple email/password login for development
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      // For development: Accept dev@recompute.it with password dev123
      // In production, this should verify against a password hash
      if (email === "dev@recompute.it" && password === "dev123") {
        // Ensure dev user exists
        const devUserId = "dev-user-123";
        const user = await storage.upsertUser({
          id: devUserId,
          email: "dev@recompute.it",
          firstName: "Dev",
          lastName: "User",
          profileImageUrl: null,
        });
        
        // Create session token
        const { createSessionToken } = await import('./auth-helpers');
        const sessionToken = createSessionToken(devUserId);
        
        res.json({
          token: sessionToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "Dev User",
          },
        });
      } else {
        res.status(401).json({ message: "Invalid email or password" });
      }
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Failed to login", error: error.message });
    }
  });
  
  // Simple email/password signup for development
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ message: "Email, password, and name are required" });
      }
      
      // For development: Create user directly
      // In production, hash password and validate email
      const userId = `email_${email.replace(/[@.]/g, "_")}`;
      
      // Check if user already exists
      const existingUser = await storage.getUser(userId);
      if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
      }
      
      // Create new user
      const nameParts = name.split(" ");
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(" ") || null;
      
      const user = await storage.upsertUser({
        id: userId,
        email: email,
        firstName: firstName,
        lastName: lastName,
        profileImageUrl: null,
      });
      
      // Create session token
      const { createSessionToken } = await import('./auth-helpers');
      const sessionToken = createSessionToken(userId);
      
      res.json({
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: name,
        },
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to sign up", error: error.message });
    }
  });

  // Magic Link Request
  app.post("/api/auth/magic-link", async (req, res) => {
    try {
      const { email } = req.body;
      const { createMagicLinkToken } = await import("./auth-helpers");
      
      const token = await createMagicLinkToken(email);
      
      // In a real app, send email here
      console.log(`[MAGIC LINK] To: ${email}, Token: ${token}`);
      
      res.json({ success: true, message: "Magic link sent (check console for dev)" });
    } catch (error) {
      res.status(500).json({ message: "Failed to send magic link" });
    }
  });

  // Magic Link Verify
  app.post("/api/auth/magic-link/verify", async (req, res) => {
    try {
      const { email, token } = req.body;
      const { verifyMagicLinkToken, createSessionToken } = await import("./auth-helpers");
      
      const isValid = await verifyMagicLinkToken(email, token);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      
      // Create/Get user
      // Note: In real app, you'd look up user by email
      const userId = "magic-" + Buffer.from(email).toString('hex');
      
      await storage.upsertUser({
        id: userId,
        email: email,
        firstName: "User",
        lastName: "",
        profileImageUrl: null
      });
      
      const sessionToken = createSessionToken(userId);
      res.json({ token: sessionToken });
    } catch (error) {
      res.status(401).json({ message: "Verification failed" });
    }
  });

  // ========== PROFILE ROUTES ==========
  
  app.get("/api/profile", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      res.json(profile || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.get("/api/profile/generation-limit", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const generationStatus = await workoutGenerationService.canGenerateProgram(userId);
      res.json({
        allowed: generationStatus.allowed,
        remaining: generationStatus.remaining,
        total: 5,
        resetDate: generationStatus.resetDate,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch generation limit" });
    }
  });

  // Suggest training goals based on user profile
  app.post("/api/profile/suggest-goals", async (req: any, res) => {
    try {
      const {
        motivationType,
        trainingLevel,
        age,
        sex,
        bodyWeight,
        height,
        oneRmBench,
        oneRmOhp,
        oneRmDeadlift,
        oneRmSquat,
        oneRmLatpull,
      } = req.body;

      const suggestedGoals = calculateSuggestedGoals({
        motivationType,
        trainingLevel,
        age,
        sex,
        bodyWeight,
        height,
        oneRmValues: {
          oneRmBench: oneRmBench || null,
          oneRmOhp: oneRmOhp || null,
          oneRmDeadlift: oneRmDeadlift || null,
          oneRmSquat: oneRmSquat || null,
          oneRmLatpull: oneRmLatpull || null,
        },
      });

      res.json(suggestedGoals);
    } catch (error) {
      console.error("Error calculating suggested goals:", error);
      res.status(500).json({ message: "Failed to calculate suggested goals" });
    }
  });

  // Suggest 1RM values based on user profile
  app.post("/api/profile/suggest-onerm", async (req: any, res) => {
    const requestId = `1RM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const requestStartTime = Date.now();
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[BACKEND] 📥 REQUEST ${requestId} - /api/profile/suggest-onerm`);
    console.log(`[BACKEND] ⏰ Start Time: ${new Date(requestStartTime).toISOString()}`);
    console.log(`[BACKEND ${requestId}] Query: ${JSON.stringify(req.query)}`);
    console.log(`[BACKEND ${requestId}] Body: ${JSON.stringify(req.body)}`);
    
    try {
      const {
        motivationType,
        trainingLevel,
        age,
        sex,
        bodyWeight,
        height,
      } = req.body;

      // Always use V3 AI for 1RM estimation (consolidated)
      console.log("[BACKEND] ✅ Using V3 AI analysis for 1RM estimation");
      
      const { analyzeUserProfile, mapOnboardingToV3Profile } = await import("./ai-service-v3");
      
      // Map to V3 profile format
      const v3Profile = mapOnboardingToV3Profile({
        motivationType,
        trainingLevel,
        age,
        sex,
        bodyWeight,
        height,
      });
      
      console.log("[BACKEND] 🤖 Calling analyzeUserProfile (V3)...");
      const analysisStartTime = Date.now();
      const analysisResult = await analyzeUserProfile(v3Profile);
      const analysisDuration = Date.now() - analysisStartTime;
      console.log(`[BACKEND] ⏱️  Analysis completed in ${analysisDuration}ms`);
      
      // Return in the format iOS expects (rounded to integers)
      const response = {
        oneRmBench: Math.round(analysisResult.estimated_1rm_kg.bench_press),
        oneRmOhp: Math.round(analysisResult.estimated_1rm_kg.overhead_press),
        oneRmDeadlift: Math.round(analysisResult.estimated_1rm_kg.deadlift),
        oneRmSquat: Math.round(analysisResult.estimated_1rm_kg.squat),
        oneRmLatpull: Math.round(analysisResult.estimated_1rm_kg.lat_pulldown),
      };
      
      const duration = Date.now() - requestStartTime;
      console.log(`[BACKEND] /api/profile/suggest-onerm completed in ${duration}ms`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      res.json(response);
    } catch (error) {
      const duration = Date.now() - requestStartTime;
      console.error(`[BACKEND] Error in /api/profile/suggest-onerm after ${duration}ms:`, error);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      res.status(500).json({ message: "Failed to calculate suggested 1RM" });
    }
  });

  app.post("/api/profile", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertUserProfileSchema.parse({
        ...req.body,
        userId,
      });
      const profile = await storage.upsertUserProfile(validatedData);
      res.json(profile);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.patch("/api/profile", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = updateUserProfileSchema.parse(req.body);
      const { forceRegenerate, ...profileUpdates } = validatedData;
      
      // Get old profile to detect what changed
      const oldProfile = await storage.getUserProfile(userId);
      
      // Detect MAJOR changes that require AI regeneration
      const majorChanges = !!(
        (validatedData.motivationType && validatedData.motivationType !== oldProfile?.motivationType) ||
        (validatedData.trainingLevel && validatedData.trainingLevel !== oldProfile?.trainingLevel) ||
        (validatedData.specificSport && validatedData.specificSport !== oldProfile?.specificSport) ||
        (validatedData.trainingGoals && validatedData.trainingGoals !== oldProfile?.trainingGoals) ||
        (validatedData.goalStrength !== undefined && validatedData.goalStrength !== oldProfile?.goalStrength) ||
        (validatedData.goalVolume !== undefined && validatedData.goalVolume !== oldProfile?.goalVolume) ||
        (validatedData.goalEndurance !== undefined && validatedData.goalEndurance !== oldProfile?.goalEndurance) ||
        (validatedData.goalCardio !== undefined && validatedData.goalCardio !== oldProfile?.goalCardio) ||
        (validatedData.sessionsPerWeek && validatedData.sessionsPerWeek !== oldProfile?.sessionsPerWeek) ||
        (validatedData.selectedGymId !== undefined && validatedData.selectedGymId !== oldProfile?.selectedGymId) ||
        forceRegenerate
      );
      
      // Detect MINOR changes (only session duration changed)
      const onlyDurationChanged = !majorChanges && !!(
        validatedData.sessionDuration && 
        validatedData.sessionDuration !== oldProfile?.sessionDuration
      );
      
      if (onlyDurationChanged) {
      }
      
      // Trigger AI regeneration for major changes OR duration changes
      // TODO: Implement local duration adjustment to avoid AI calls for minor changes
      const trainingSettingsChanged = majorChanges || onlyDurationChanged;
      
      // Check generation limit BEFORE updating profile
      if (trainingSettingsChanged) {
        const generationStatus = await workoutGenerationService.canGenerateProgram(userId);
        if (!generationStatus.allowed) {
          const resetDate = generationStatus.resetDate?.toLocaleDateString('sv-SE');
          return res.status(429).json({ 
            message: "Du har nått gränsen för programgenerering denna vecka (5 st). Försök igen nästa vecka.", 
            remaining: 0,
            resetDate: generationStatus.resetDate
          });
        }
      }
      
      // Update profile in database
      const profile = await storage.updateUserProfile(userId, profileUpdates);
      
      // Regenerate program if training settings changed
      if (trainingSettingsChanged) {
        try {
          // Get profile data for V3 generation
          const profileData = await storage.getUserProfile(userId);
          const equipment = await storage.getUserEquipment(userId);
          const equipmentList = equipment.map(eq => eq.equipmentName);
          
          // Generate program using V3 architecture
          const v3Result = await generateV3Program({
            userId,
            profile: {
              age: profileData?.age || undefined,
              sex: profileData?.sex || undefined,
              bodyWeight: profileData?.bodyWeight || undefined,
              height: profileData?.height || undefined,
              trainingLevel: profileData?.trainingLevel || undefined,
              motivationType: profileData?.motivationType || undefined,
              trainingGoals: profileData?.trainingGoals || undefined,
              specificSport: profileData?.specificSport || undefined,
              oneRmBench: profileData?.oneRmBench,
              oneRmOhp: profileData?.oneRmOhp,
              oneRmDeadlift: profileData?.oneRmDeadlift,
              oneRmSquat: profileData?.oneRmSquat,
              oneRmLatpull: profileData?.oneRmLatpull,
              goalStrength: profileData?.goalStrength || undefined,
              goalVolume: profileData?.goalVolume || undefined,
              goalEndurance: profileData?.goalEndurance || undefined,
              goalCardio: profileData?.goalCardio || undefined,
            },
            sessionsPerWeek: profileData?.sessionsPerWeek || 3,
            sessionDuration: profileData?.sessionDuration || 60,
            equipmentList,
            gymId: profileData?.selectedGymId || undefined,
          });
          
          await storage.clearUserProgramTemplates(userId);
          await storage.createProgramTemplatesFromDeepSeek(userId, v3Result.deepSeekFormat);
          await storage.incrementProgramGeneration(userId);
          // Reset pass counter to 1 for new program cycle
          await storage.updateUserProfile(userId, { currentPassNumber: 1 });
          
          const generationStatus = await workoutGenerationService.canGenerateProgram(userId);
        } catch (programError) {
          
          // Rollback profile to old values since AI generation failed
          if (oldProfile) {
            // Restore fields that were actually updated to prevent partial updates
            const rollbackData: any = {};
            for (const key of Object.keys(profileUpdates)) {
              if (key !== 'forceRegenerate' && key in oldProfile && oldProfile[key as keyof typeof oldProfile] !== undefined) {
                rollbackData[key] = (oldProfile as any)[key];
              }
            }
            if (Object.keys(rollbackData).length > 0) {
              await storage.updateUserProfile(userId, rollbackData);
            }
          } else {
          }
          
          return res.status(500).json({ 
            message: "AI-genereringen misslyckades. Profilen kunde inte uppdateras.", 
            error: programError instanceof Error ? programError.message : "Unknown error"
          });
        }
      }
      
      res.json(profile);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: "Profile not found" });
      }
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Reset profile to default values (for debug "Återställ onboarding" functionality)
  app.post("/api/profile/reset", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Reset profile values to defaults
      const resetData = {
        // Personal info - set to null
        age: null,
        sex: null,
        bodyWeight: null,
        height: null,
        bodyFatPercent: null,
        muscleMassPercent: null,
        
        // 1RM values - set to null
        oneRmBench: null,
        oneRmOhp: null,
        oneRmDeadlift: null,
        oneRmSquat: null,
        oneRmLatpull: null,
        
        // Goals - reset to defaults (25% each)
        goalStrength: 25,
        goalVolume: 25,
        goalEndurance: 25,
        goalCardio: 25,
        
        // Training settings - reset to defaults
        motivationType: null,
        trainingLevel: null,
        specificSport: null,
        sessionsPerWeek: 3,
        sessionDuration: 60,
        
        // Program tracking
        currentPassNumber: 1,
        lastCompletedTemplateId: null,
        selectedGymId: null,
        onboardingCompleted: false,
      };
      
      await storage.updateUserProfile(userId, resetData as any);
      
      console.log(`[PROFILE RESET] ✅ Reset profile for user ${userId}`);
      res.json({ success: true, message: "Profile reset to defaults" });
    } catch (error) {
      console.error("[PROFILE RESET] ❌ Error:", error);
      res.status(500).json({ message: "Failed to reset profile" });
    }
  });

  app.post("/api/upload-avatar", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!req.files || !req.files.image) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const imageFile = req.files.image;
      
      if (imageFile.size > 10 * 1024 * 1024) {
        return res.status(400).json({ message: "File too large (max 10MB)" });
      }

      // Create a data URL from the uploaded file for storage
      const buffer = imageFile.data;
      const base64 = buffer.toString("base64");
      const mimeType = imageFile.mimetype || "image/jpeg";
      const imageUrl = `data:${mimeType};base64,${base64}`;

      // Update profile with image URL
      await storage.updateUserProfile(userId, {
        avatarType: "image",
        avatarImageUrl: imageUrl,
      });

      res.json({ imageUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload avatar" });
    }
  });

  // Onboarding endpoint with auth middleware
  app.post("/api/onboarding/complete", isAuthenticatedOrDev, async (req: any, res) => {
    // Early logging to catch requests immediately
    console.log("[ONBOARDING] 📥 REQUEST RECEIVED - /api/onboarding/complete");
    console.log("[ONBOARDING] ⏰ Time:", new Date().toISOString());
    console.log("[ONBOARDING] 📋 Method:", req.method);
    console.log("[ONBOARDING] 🌐 URL:", req.url);
    console.log("[ONBOARDING] 📦 Body keys:", Object.keys(req.body || {}));
    console.log("[ONBOARDING] 🔍 Query params:", req.query);
    
    try {
      // Use a default dev user ID if no authentication
      let userId = "dev-user-123";
      if (req.user?.claims?.sub) {
        userId = req.user.claims.sub;
      } else {
        // Ensure dev user exists
        userId = await ensureDevUserExists();
      }
      const { profile, equipment } = req.body;

      if (!profile?.motivationType || !profile?.trainingLevel || !profile?.sessionsPerWeek || !profile?.sessionDuration) {
        return res.status(400).json({ message: "Missing required profile fields" });
      }

      const goalStrength = Math.max(0, Math.min(100, profile.goalStrength ?? 50));
      const goalVolume = Math.max(0, Math.min(100, profile.goalVolume ?? 50));
      const goalEndurance = Math.max(0, Math.min(100, profile.goalEndurance ?? 50));
      const goalCardio = Math.max(0, Math.min(100, profile.goalCardio ?? 50));
      const sessionsPerWeek = Math.max(1, Math.min(7, profile.sessionsPerWeek));
      const sessionDuration = Math.max(15, Math.min(180, profile.sessionDuration));

      const equipmentRegistered = equipment && Array.isArray(equipment) && equipment.length > 0;

      const preliminaryProfile = insertUserProfileSchema.parse({
        ...profile,
        userId, // Now correctly set from ensureDevUserExists()
        goalStrength,
        goalVolume,
        goalEndurance,
        goalCardio,
        sessionsPerWeek,
        sessionDuration,
        onboardingCompleted: false,
        equipmentRegistered: false,
      });

      await storage.upsertUserProfile(preliminaryProfile);

      let firstGym: any = null;
      if (equipmentRegistered) {
        firstGym = await storage.createGym({
          userId,
          name: "Mitt Gym",
        });

        const uniqueEquipment = Array.from(new Set(equipment));
        const equipmentPromises = uniqueEquipment.map((equipmentName: string) =>
          storage.upsertEquipment({
            userId,
            gymId: firstGym.id,
            equipmentType: "gym",
            equipmentName,
            available: true,
          })
        );
        await Promise.all(equipmentPromises);
      }

      const finalProfile = await storage.upsertUserProfile({
        ...preliminaryProfile,
        onboardingCompleted: true,
        equipmentRegistered,
        selectedGymId: firstGym?.id || null,
      });

      // Generate workout program automatically after onboarding (V3 only)
      const onboardingRequestId = `ONBOARDING-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const onboardingStartTime = Date.now();
      
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`[ONBOARDING] 📥 REQUEST ${onboardingRequestId} - /api/onboarding/complete`);
      console.log(`[ONBOARDING] ⏰ Start Time: ${new Date(onboardingStartTime).toISOString()}`);
      console.log(`[ONBOARDING ${onboardingRequestId}] 🚀 Using V3 AI architecture (consolidated)`);
      
      let programResponse: any = null;
      try {
        console.log(`[ONBOARDING ${onboardingRequestId}] ✅ Starting V3 program generation...`);
          
          // Step 1: Analyze user profile
          const step1StartTime = Date.now();
          console.log(`[ONBOARDING ${onboardingRequestId}] 📦 Importing ai-service-v3...`);
          const { analyzeUserProfile, createWorkoutProgram, mapOnboardingToV3Profile } = await import("./ai-service-v3");
          console.log(`[ONBOARDING ${onboardingRequestId}] ⏱️  Import completed in ${Date.now() - step1StartTime}ms`);
          
          const v3Profile = mapOnboardingToV3Profile(profile);
          console.log(`[ONBOARDING ${onboardingRequestId}] 🔄 Step 1: Analyzing user profile...`);
          console.log(`[ONBOARDING ${onboardingRequestId}] 📋 V3 Profile:`, JSON.stringify(v3Profile, null, 2));
          
          const analysisStartTime = Date.now();
          const analysisResult = await analyzeUserProfile(v3Profile);
          const analysisDuration = Date.now() - analysisStartTime;
          console.log(`[ONBOARDING ${onboardingRequestId}] ✅ Step 1: Analysis complete in ${analysisDuration}ms`);
          console.log(`[ONBOARDING ${onboardingRequestId}] 📊 Analysis Result:`, {
            focusDistribution: analysisResult.focus_distribution,
            estimated1RM: analysisResult.estimated_1rm_kg,
          });
          
          // Use estimated 1RM if user didn't provide their own, or use confirmed if provided
          const confirmed1Rm = v3Profile.confirmed1Rm || {
            bench_press: analysisResult.estimated_1rm_kg.bench_press,
            overhead_press: analysisResult.estimated_1rm_kg.overhead_press,
            deadlift: analysisResult.estimated_1rm_kg.deadlift,
            squat: analysisResult.estimated_1rm_kg.squat,
            lat_pulldown: analysisResult.estimated_1rm_kg.lat_pulldown,
          };
          
          // Use focus distribution from analysis if not provided
          const focusDistribution = v3Profile.focusDistribution || analysisResult.focus_distribution;
          
          // Step 2: Create program
          const step2StartTime = Date.now();
          console.log(`[ONBOARDING ${onboardingRequestId}] 🔄 Step 2: Creating workout program...`);
          
          const equipmentList = equipment && equipment.length > 0 
            ? equipment.join(", ")
            : "Bodyweight only";
          
          // Get filtered exercises based on user's equipment
          const { filterExercisesByUserEquipment } = await import("./exercise-matcher");
          const filteredExercises = await filterExercisesByUserEquipment(userId, finalProfile.selectedGymId || undefined);
          const filteredExerciseNames = filteredExercises.map(ex => ex.nameEn);
          
          console.log(`[ONBOARDING ${onboardingRequestId}] 📋 Program Context:`, {
            sessionsPerWeek,
            sessionDurationMinutes: sessionDuration,
            equipmentCount: equipment?.length || 0,
            equipmentList: equipmentList.substring(0, 100) + (equipmentList.length > 100 ? "..." : ""),
            filteredExerciseCount: filteredExerciseNames.length,
            filteredExercisesSample: filteredExerciseNames.slice(0, 10),
          });
          
          const programResult = await createWorkoutProgram(
            {
              ...v3Profile,
              confirmed1Rm,
              focusDistribution,
            },
            {
              sessionsPerWeek,
              sessionDurationMinutes: sessionDuration,
              equipmentList,
              filteredExerciseNames, // Pass filtered exercise names to AI
            }
          );
          
          const step2Duration = Date.now() - step2StartTime;
          console.log(`[ONBOARDING ${onboardingRequestId}] ✅ Step 2: Program created in ${step2Duration}ms with ${programResult.schedule.length} days`);
          
          // Convert V3 program format to DeepSeek format for storage
          const convertedProgram = {
            program_name: programResult.program_name,
            program_overview: {
              total_sessions: programResult.schedule.length,
              sport_specific_note: programResult.sport_specific_note,
            },
            weekly_sessions: programResult.schedule.map((day, idx) => ({
              session_number: idx + 1,
              weekday: day.day_name,
              session_name: day.day_name,
              session_type: "strength", // Default, could be determined from exercises
              estimated_duration_minutes: sessionDuration,
              warmup: [],
              main_work: day.exercises.map((ex, exIdx) => ({
                exercise_name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                rest_seconds: ex.rest_seconds,
                tempo: "",
                suggested_weight_kg: ex.calculated_weight,
                suggested_weight_notes: ex.load_guidance,
                target_muscles: [],
                required_equipment: [],
                technique_cues: ex.note ? [ex.note] : [],
              })),
              cooldown: [],
            })),
          };
          
          // Save program using DeepSeek function which validates exercises against equipment
          // Note: clearUserProgramTemplates is called inside createProgramTemplatesFromDeepSeek
          await storage.createProgramTemplatesFromDeepSeek(userId, convertedProgram as any);
          await storage.updateUserProfile(userId, { currentPassNumber: 1 });
          
          programResponse = {
            cached: false,
            v3: true,
            analysis: analysisResult,
            program: programResult,
          };
          
          const totalDuration = Date.now() - onboardingStartTime;
          console.log(`[ONBOARDING ${onboardingRequestId}] ✅ Program saved successfully`);
          console.log(`[ONBOARDING ${onboardingRequestId}] ⏱️  Total V3 onboarding time: ${totalDuration}ms`);
          console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      } catch (programError) {
        // Log error but don't fail onboarding if program generation fails
        const errorDuration = Date.now() - onboardingStartTime;
        console.error(`[ONBOARDING ${onboardingRequestId}] ❌ Failed to generate workout program after ${errorDuration}ms:`);
        console.error(`[ONBOARDING ${onboardingRequestId}] Error:`, programError);
        if (programError instanceof Error) {
          console.error(`[ONBOARDING ${onboardingRequestId}] Error message:`, programError.message);
          console.error(`[ONBOARDING ${onboardingRequestId}] Error stack:`, programError.stack);
        }
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        // Continue with onboarding even if program generation fails
        // User can generate program later manually
      }
      
      const totalOnboardingDuration = Date.now() - onboardingStartTime;
      console.log(`[ONBOARDING ${onboardingRequestId}] ✅ Onboarding completed in ${totalOnboardingDuration}ms`);

      // Build response - only include program if it exists
      const response: any = {
        success: true,
        profile: finalProfile,
        gym: firstGym || null,
      };
      
      if (programResponse) {
        response.program = programResponse;
      }
      
      res.json(response);
    } catch (error) {
      console.error("[ONBOARDING] Error completing onboarding:", error);
      if (error instanceof ZodError) {
        console.error("[ONBOARDING] Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors,
          details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[ONBOARDING] Error message:", errorMessage);
      res.status(500).json({ message: "Failed to complete onboarding", error: errorMessage });
    }
  });

  // ========== GYM ROUTES ==========
  
  app.get("/api/gyms", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gyms = await storage.getUserGyms(userId);
      res.json(gyms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gyms" });
    }
  });

  app.post("/api/gyms", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertGymSchema.parse({
        ...req.body,
        userId,
      });
      const gym = await storage.createGym(validatedData);
      
      // Auto-activate the newly created gym
      try {
        await storage.setSelectedGym(userId, gym.id);
      } catch (activationError) {
        // Return gym but warn that activation failed
        return res.status(201).json({ 
          ...gym, 
          warning: "Gym created but could not be auto-activated" 
        });
      }
      
      res.status(201).json(gym);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create gym" });
    }
  });

  app.patch("/api/gyms/:id", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = updateGymSchema.parse(req.body);
      const gym = await storage.updateGym(req.params.id, userId, validatedData);
      res.json(gym);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      if (error instanceof Error && error.message.includes("access denied")) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.status(500).json({ message: "Failed to update gym" });
    }
  });

  app.patch("/api/gyms/:id/select", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.setSelectedGym(userId, req.params.id);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("access denied")) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.status(500).json({ message: "Failed to select gym" });
    }
  });

  app.delete("/api/gyms/:id", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gymId = req.params.id;
      
      // Check if deleting the active gym
      const profile = await storage.getUserProfile(userId);
      const isDeletingActiveGym = profile?.selectedGymId === gymId;
      
      // Delete the gym
      await storage.deleteGym(gymId, userId);
      
      // If we deleted the active gym, auto-select another one
      if (isDeletingActiveGym) {
        const remainingGyms = await storage.getUserGyms(userId);
        if (remainingGyms.length > 0) {
          // Select the newest remaining gym
          try {
            await storage.setSelectedGym(userId, remainingGyms[0].id);
          } catch (selectionError) {
          }
        }
        // If no gyms remain, selectedGymId will be set to null by the foreign key constraint
      }
      
      res.json({ success: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("access denied")) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.status(500).json({ message: "Failed to delete gym" });
    }
  });

  // ========== EQUIPMENT ROUTES ==========
  
  app.get("/api/equipment", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const equipment = await storage.getUserEquipment(userId);
      res.json(equipment);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  app.post("/api/equipment", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertEquipmentSchema.parse({
        ...req.body,
        userId,
      });

      if (!validatedData.gymId) {
        return res.status(400).json({ message: "gymId is required" });
      }

      const gym = await storage.getGym(validatedData.gymId);
      if (!gym || gym.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: Gym does not belong to user" });
      }

      const equipment = await storage.upsertEquipment(validatedData);
      res.json(equipment);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add equipment" });
    }
  });

  app.delete("/api/equipment/:id", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const equipment = await storage.getEquipmentById(req.params.id);
      
      if (!equipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      if (equipment.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: Equipment does not belong to user" });
      }
      
      await storage.deleteEquipment(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete equipment" });
    }
  });

  app.post("/api/equipment/recognize", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const { image } = req.body;
      
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ message: "Image data required (base64 encoded)" });
      }

      const result = await recognizeEquipmentFromImage(image);
      
      res.json({
        success: true,
        equipment: result.equipment,
        confidence: result.confidence,
        detections: result.rawDetections.length,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("ROBOFLOW_API_KEY")) {
        return res.status(500).json({ message: "Equipment recognition service not configured" });
      }
      res.status(500).json({ message: "Failed to recognize equipment" });
    }
  });

  // ========== GYM PROGRAM ROUTES ==========
  
  app.get("/api/gym-programs/:gymId", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { gymId } = req.params;
      
      const gym = await storage.getGym(gymId);
      if (!gym || gym.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: Gym does not belong to user" });
      }
      
      const program = await storage.getGymProgram(userId, gymId);
      if (!program) {
        return res.status(404).json({ message: "No program found for this gym" });
      }
      
      res.json(program);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gym program" });
    }
  });

  // ========== PROGRAM TEMPLATE ROUTES ==========

  app.get("/api/program/templates", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templates = await storage.getTemplatesWithMetadata(userId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ message: "Failed to get templates" });
    }
  });

  // Delete all program templates for user
  app.delete("/api/program/templates", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`[API] Deleting all program templates for user: ${userId}`);
      
      await storage.clearUserProgramTemplates(userId);
      
      console.log(`[API] ✅ Successfully deleted all program templates for user: ${userId}`);
      res.json({ success: true, message: "All program templates deleted" });
    } catch (error: any) {
      console.error("[API] ❌ Error deleting templates:", error);
      res.status(500).json({ message: error.message || "Failed to delete templates" });
    }
  });

  // Get current program generation status
  app.get("/api/program/status", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      const isGenerating = profile?.isGeneratingProgram || false;
      const templates = await storage.getUserProgramTemplates(userId);
      const hasTemplates = templates && templates.length > 0;
      
      let status = "no_program";
      if (isGenerating) {
        status = "generating";
      } else if (hasTemplates) {
        status = "ready"; // Using "ready" which iOS looks for
      }
      
      res.json({
        status,
        message: status === "ready" 
          ? `Program ready with ${templates.length} templates` 
          : status === "generating"
            ? "AI is still generating your program. This may take up to 60 seconds."
            : "No program templates found. Please complete onboarding or generate a program.",
        hasTemplates,
        templatesCount: templates?.length || 0,
        progress: isGenerating ? 45 : (hasTemplates ? 100 : 0),
        jobId: null,
        error: null,
      });
    } catch (error) {
      console.error("Error getting program status:", error);
      res.status(500).json({ 
        status: "error",
        message: "Failed to get program status",
        hasTemplates: false,
        templatesCount: 0,
        progress: null,
        jobId: null,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get generation job status (simplified - returns basic status)
  app.get("/api/program/generate/status/:jobId", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { jobId } = req.params;

      // For now, return a basic status since job system may not be fully implemented
      // In a full implementation, this would check the job status from a job queue
      const templates = await storage.getUserProgramTemplates(userId);
      const hasTemplates = templates && templates.length > 0;
      
      res.json({
        status: hasTemplates ? "completed" : "generating",
        progress: hasTemplates ? 100 : 50,
        program: hasTemplates ? templates : null,
        error: null,
      });
    } catch (error: any) {
      console.error("Error getting job status:", error);
      res.status(500).json({ 
        status: "failed",
        progress: 0,
        program: null,
        error: error.message || "Failed to get job status"
      });
    }
  });

  // ========== LOCAL GENERATION ROUTES ==========
  
  // Generate program locally from cached patterns (no AI call)
  app.post("/api/program/generate-local", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ 
          success: false,
          message: "User profile not found" 
        });
      }
      
      // Get user's equipment
      const userEquipment = await storage.getUserEquipment(userId);
      const equipmentNames = userEquipment.map((eq: any) => eq.equipmentName.toLowerCase());
      
      const { generateLocalProgram } = await import("./local-generator");
      
      const result = await generateLocalProgram({
        trainingGoal: profile.motivationType || profile.trainingGoals || 'general',
        trainingLevel: profile.trainingLevel || 'intermediate',
        daysPerWeek: profile.sessionsPerWeek || 3,
        sessionDuration: profile.sessionDuration || 60,
        equipment: equipmentNames,
        goalStrength: profile.goalStrength ?? 50,
        goalVolume: profile.goalVolume ?? 50,
        goalEndurance: profile.goalEndurance ?? 50,
        goalCardio: profile.goalCardio ?? 50,
      });
      
      if (result.success && result.program) {
        res.json({
          success: true,
          source: result.source,
          matchScore: result.matchScore,
          patternId: result.patternId,
          program: result.program,
          message: result.message,
        });
      } else {
        res.json({
          success: false,
          source: result.source,
          message: result.message || "Local generation not possible, AI fallback required",
        });
      }
    } catch (error: any) {
      console.error("Error in local generation:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Local generation failed"
      });
    }
  });
  
  // Get local generation statistics
  app.get("/api/program/local-stats", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const { getLocalGenerationStats } = await import("./local-generator");
      const { getPatternStats } = await import("./pattern-collector");
      
      const localStats = await getLocalGenerationStats();
      const patternStats = await getPatternStats();
      
      res.json({
        canGenerateLocally: localStats.canGenerateLocally,
        patterns: {
          total: patternStats.totalPatterns,
          topPatterns: patternStats.topPatterns,
        },
        rules: {
          total: patternStats.totalSelectionRules,
        },
        substitutions: {
          total: patternStats.totalSubstitutions,
        },
        topGoals: localStats.topGoals,
      });
    } catch (error: any) {
      console.error("Error getting local stats:", error);
      res.status(500).json({ 
        message: error.message || "Failed to get local generation stats"
      });
    }
  });

  app.get("/api/program/next", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.getNextTemplate(userId);
      
      if (!result) {
        return res.status(404).json({ message: "No program templates found. Please migrate or create a program first." });
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to get next template" });
    }
  });

  app.get("/api/program/:id", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templateId = req.params.id;
      
      const template = await storage.getProgramTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      if (template.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const exercises = await storage.getTemplateExercises(templateId);
      
      res.json({ ...template, exercises });
    } catch (error) {
      res.status(500).json({ message: "Failed to get template" });
    }
  });

  const updateExerciseSchema = z.object({
    id: z.string(),
    orderIndex: z.number().int().min(0),
    targetSets: z.number().int().min(1),
    targetReps: z.string(),
    targetWeight: z.number().int().nullable().optional(),
  });

  // Add exercise to template
  app.post("/api/program/templates/:templateId/exercises", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { templateId } = req.params;
      const { exerciseName, targetSets = 3, targetReps = 8, targetWeight = null } = req.body;
      
      const template = await storage.getProgramTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      if (template.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Get current exercises to determine next orderIndex
      const currentExercises = await storage.getTemplateExercises(templateId);
      const nextOrderIndex = currentExercises.length;
      
      // Find exercise in catalog to get metadata
      const [exerciseFromCatalog] = await db
        .select()
        .from(exercises)
        .where(eq(exercises.name, exerciseName));
      
      // Create new exercise in template using Drizzle's insert builder
      const result = await db
        .insert(programTemplateExercises)
        .values([{
          templateId,
          exerciseKey: exerciseFromCatalog?.id || exerciseName.toLowerCase().replace(/\s+/g, '-'),
          exerciseName,
          orderIndex: nextOrderIndex,
          targetSets: parseInt(String(targetSets)) || 3,
          targetReps: String(parseInt(String(targetReps)) || 8),
          targetWeight: targetWeight ? parseInt(String(targetWeight)) : null,
          muscles: exerciseFromCatalog?.primaryMuscles || [],
          requiredEquipment: exerciseFromCatalog?.requiredEquipment || [],
        }])
        .returning();
      
      res.json(result[0]);
    } catch (error) {
      res.status(500).json({ message: "Failed to add exercise" });
    }
  });

  app.patch("/api/program/templates/:id", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templateId = req.params.id;
      
      const template = await storage.getProgramTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      if (template.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: Template does not belong to user" });
      }
      
      const { exercises } = req.body;
      if (!exercises || !Array.isArray(exercises)) {
        return res.status(400).json({ message: "Invalid exercises data" });
      }
      
      // Validate each exercise
      try {
        exercises.forEach(ex => updateExerciseSchema.parse(ex));
      } catch (validationError) {
        return res.status(400).json({ message: "Invalid exercise format", error: validationError });
      }
      
      await storage.updateTemplateExercises(templateId, exercises);
      
      res.json({ success: true, message: "Template exercises updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update template exercises" });
    }
  });

  const updateTemplateMetaSchema = z.object({
    dayOfWeek: z.number().int().min(1).max(7).optional(),
  });

  app.patch("/api/program/:id/meta", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templateId = req.params.id;
      
      const template = await storage.getProgramTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      if (template.userId !== userId) {
        return res.status(403).json({ message: "Forbidden: Template does not belong to user" });
      }
      
      const validatedData = updateTemplateMetaSchema.parse(req.body);
      
      const updatedTemplate = await storage.updateProgramTemplate(templateId, validatedData);
      
      res.json(updatedTemplate);
    } catch (error) {
      res.status(500).json({ message: "Failed to update template metadata" });
    }
  });

  app.post("/api/program/migrate", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "User profile not found" });
      }
      
      if (!profile.hasAiProgram || !profile.aiProgramData) {
        return res.status(400).json({ message: "No AI program data to migrate" });
      }
      
      const existingTemplates = await storage.getUserProgramTemplates(userId);
      if (existingTemplates.length > 0) {
        return res.json({ success: true, message: "Templates already exist", alreadyMigrated: true });
      }
      
      
      await storage.createProgramTemplatesFromAI(userId, profile.aiProgramData);
      
      const newTemplates = await storage.getUserProgramTemplates(userId);
      
      res.json({ success: true, message: "Program templates created successfully", templatesCreated: newTemplates.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to migrate program" });
    }
  });

  // ========== AI WORKOUT GENERATION ==========

  app.post("/api/workouts/generate", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const profile = await storage.getUserProfile(userId);
      if (!profile || !profile.onboardingCompleted) {
        return res.status(400).json({ message: "Onboarding must be completed first" });
      }

      const equipment = await storage.getUserEquipment(userId);
      const equipmentList = equipment.map(eq => eq.equipmentName);
      
      // Use V3 generator
      const v3Result = await generateV3Program({
        userId,
        profile: {
          age: profile.age || undefined,
          sex: profile.sex || undefined,
          bodyWeight: profile.bodyWeight || undefined,
          height: profile.height || undefined,
          trainingLevel: profile.trainingLevel || undefined,
          motivationType: profile.motivationType || undefined,
          trainingGoals: profile.trainingGoals || undefined,
          specificSport: profile.specificSport || undefined,
          oneRmBench: profile.oneRmBench,
          oneRmOhp: profile.oneRmOhp,
          oneRmDeadlift: profile.oneRmDeadlift,
          oneRmSquat: profile.oneRmSquat,
          oneRmLatpull: profile.oneRmLatpull,
          goalStrength: profile.goalStrength || undefined,
          goalVolume: profile.goalVolume || undefined,
          goalEndurance: profile.goalEndurance || undefined,
          goalCardio: profile.goalCardio || undefined,
        },
        sessionsPerWeek: profile.sessionsPerWeek || 3,
        sessionDuration: profile.sessionDuration || 60,
        equipmentList,
        gymId: profile.selectedGymId || undefined,
      });

      // Update profile with AI program flag
      await storage.updateUserProfile(userId, {
        hasAiProgram: true,
        aiProgramData: v3Result.deepSeekFormat,
      });

      res.json({ success: true, program: v3Result.deepSeekFormat, analysis: v3Result.analysisResult });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to generate workout program",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // New V3 workout generation
  app.post("/api/programs/generate", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const validatedRequest = generateProgramRequestSchema.parse(req.body);
      const { force = false } = validatedRequest;
      
      // Check if user can generate a program (weekly limit)
      const generationStatus = await workoutGenerationService.canGenerateProgram(userId);
      if (!generationStatus.allowed && !force) {
        return res.status(429).json({ 
          message: "Du har nått gränsen för programgenerering denna vecka (5 st). Försök igen nästa vecka.",
          remaining: 0,
          resetDate: generationStatus.resetDate,
          canRetry: false,
        });
      }
      
      // Get profile and equipment for V3 generation
      const profile = await storage.getUserProfile(userId);
      if (!profile) {
        return res.status(400).json({ message: "Användarprofil saknas" });
      }
      
      const equipment = await storage.getUserEquipment(userId);
      const equipmentList = equipment.map(eq => eq.equipmentName);
      
      // Generate program using V3 architecture
      const v3Result = await generateV3Program({
        userId,
        profile: {
          age: profile.age || undefined,
          sex: profile.sex || undefined,
          bodyWeight: profile.bodyWeight || undefined,
          height: profile.height || undefined,
          trainingLevel: profile.trainingLevel || undefined,
          motivationType: profile.motivationType || undefined,
          trainingGoals: profile.trainingGoals || undefined,
          specificSport: profile.specificSport || undefined,
          oneRmBench: profile.oneRmBench,
          oneRmOhp: profile.oneRmOhp,
          oneRmDeadlift: profile.oneRmDeadlift,
          oneRmSquat: profile.oneRmSquat,
          oneRmLatpull: profile.oneRmLatpull,
          goalStrength: profile.goalStrength || undefined,
          goalVolume: profile.goalVolume || undefined,
          goalEndurance: profile.goalEndurance || undefined,
          goalCardio: profile.goalCardio || undefined,
        },
        sessionsPerWeek: profile.sessionsPerWeek || 3,
        sessionDuration: profile.sessionDuration || 60,
        equipmentList,
        gymId: profile.selectedGymId || undefined,
      });
      
      // Clear existing templates
      await storage.clearUserProgramTemplates(userId);
      
      // Save new templates to database
      await storage.createProgramTemplatesFromDeepSeek(userId, v3Result.deepSeekFormat);
      
      // Reset pass counter to 1 for new program cycle
      await storage.updateUserProfile(userId, { currentPassNumber: 1 });
      
      // Also save program to gym_programs for selected gym
      if (profile.selectedGymId) {
        await storage.upsertGymProgram({
          userId,
          gymId: profile.selectedGymId,
          programData: v3Result.deepSeekFormat,
        });
      }
      
      // Increment generation count
      await storage.incrementProgramGeneration(userId);
      
      // Get created templates for response
      const templates = await storage.getUserProgramTemplates(userId);
      
      res.json({ 
        success: true, 
        message: "Träningsprogram genererat",
        templatesCreated: templates.length,
        programOverview: v3Result.deepSeekFormat.program_overview,
        analysis: v3Result.analysisResult,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Ogiltig förfrågan", 
          errors: error.errors 
        });
      }
      res.status(500).json({ 
        message: "Kunde inte generera träningsprogram",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/workouts/suggest-alternative", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const validatedData = suggestAlternativeRequestSchema.parse(req.body);
      const { originalExercise, targetMuscleGroups, availableEquipment } = validatedData;

      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "AI service not configured" });
      }

      const equipmentList = availableEquipment.map((e: any) => e.equipmentName).join(", ");
      
      const prompt = `Du är en personlig tränare. En användare behöver en alternativ övning eftersom deras nuvarande gym saknar nödvändig utrustning.

ORIGINAL ÖVNING: ${originalExercise.title}
TRÄNAR: ${targetMuscleGroups.join(", ")}
TILLGÄNGLIG UTRUSTNING: ${equipmentList}

Föreslå 3 alternativa övningar som:
1. Tränar samma muskelgrupper
2. Kan utföras med tillgänglig utrustning
3. Har liknande svårighetsgrad

Svara ENDAST med ett JSON-objekt i följande format (ingen annan text):
{
  "alternatives": [
    {
      "title": "Övningsnamn",
      "muscleGroups": ["Muskelgrupp 1", "Muskelgrupp 2"],
      "equipment": ["Utrustning 1"],
      "difficulty": "beginner/intermediate/advanced",
      "description": "Kort beskrivning av övningen"
    }
  ]
}`;

      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "Du är en expert personlig tränare som föreslår alternativa övningar." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error("No response from AI service");
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("AI service returned invalid response format");
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        throw new Error("AI service returned malformed JSON");
      }

      const validated = suggestAlternativeResponseSchema.safeParse(parsedResponse);
      if (!validated.success) {
        return res.status(500).json({ 
          message: "AI service returned invalid data structure",
        });
      }

      res.json({
        success: true,
        originalExercise,
        alternatives: validated.data.alternatives,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ 
        message: "Failed to suggest alternative exercises",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========== WORKOUT SESSION ROUTES ==========
  
  app.get("/api/sessions", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      const sessions = await storage.getUserWorkoutSessions(userId, limit);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get("/api/sessions/active", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const activeSession = await storage.getActiveWorkoutSession(userId);
      res.json(activeSession || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active session" });
    }
  });

  app.post("/api/sessions", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertWorkoutSessionSchema.parse({
        ...req.body,
        userId,
      });
      const session = await storage.createWorkoutSession(validatedData);
      res.json(session);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.get("/api/sessions/:id", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getWorkoutSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session" });
    }
  });

  app.get("/api/sessions/:id/details", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getWorkoutSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const exerciseLogs = await storage.getSessionExerciseLogs(req.params.id);
      
      res.json({
        session,
        exerciseLogs
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch session details" });
    }
  });

  app.patch("/api/sessions/:id/snapshot", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getWorkoutSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Update snapshot data (for now, just skippedExercises)
      const { skippedExercises } = req.body;
      
      if (!Array.isArray(skippedExercises)) {
        return res.status(400).json({ message: "skippedExercises must be an array" });
      }

      await storage.updateSessionSnapshot(req.params.id, { skippedExercises });
      
      res.json({ success: true, message: "Snapshot updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update snapshot" });
    }
  });

  app.post("/api/sessions/:id/complete", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getWorkoutSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Validate that all exercises are completed if session has a template
      if (session.templateId) {
        try {
          const template = await storage.getProgramTemplate(session.templateId);
          
          // If template is deleted (null), allow completion with existing logs (soft warning)
          // This handles historical sessions where templates may have been deleted
          if (template) {
            const exercises = await storage.getTemplateExercises(session.templateId);
            const sessionLogs = await storage.getSessionExerciseLogs(req.params.id);

            const missingExercises: Array<{ title: string; plannedSets: number; completedSets: number }> = [];

            exercises.forEach(plannedEx => {
              const completedLogs = sessionLogs.filter(log => log.exerciseTitle === plannedEx.exerciseName);
              const completedSets = completedLogs.length;
              const plannedSets = plannedEx.targetSets;

              if (completedSets < plannedSets) {
                missingExercises.push({
                  title: plannedEx.exerciseName,
                  plannedSets,
                  completedSets,
                });
              }
            });

            if (missingExercises.length > 0) {
              return res.status(400).json({ 
                message: "Inte alla övningar är genomförda",
                missingExercises 
              });
            }
          }
          // If template is null, we fall through and allow completion
        } catch (error) {
          // Storage error - log but allow completion to avoid blocking users
          // Continue to completion - don't block user on storage errors
        }
      }
      
      const movergyScore = req.body.movergyScore;
      await storage.completeWorkoutSession(req.params.id, movergyScore);
      
      // Auto-increment pass number when session completed (1→2→3→4→1)
      if (session.templateId) {
        await storage.incrementPassNumber(userId);
      }
      
      // Sync workout to Vital API (Apple Health, Google Fit, etc.)
      // This makes the activity ring show 100% when workout is completed
      try {
        const sessionLogs = await storage.getSessionExerciseLogs(req.params.id);
        const sessionStart = new Date(session.startedAt);
        const sessionEnd = new Date();
        const durationMinutes = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000 / 60);
        
        // Estimate active calories (rough: 5 cal per minute for strength training)
        const activeCalories = Math.round(durationMinutes * 5);
        const totalSets = sessionLogs.length;
        const uniqueExercises = new Set(sessionLogs.map(l => l.exerciseTitle)).size;
        
        await vitalService.syncWorkoutToVital(userId, {
          durationMinutes,
          activeCalories,
          totalSets,
          totalExercises: uniqueExercises,
        });
      } catch (vitalError) {
        // Don't fail session completion if Vital sync fails
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to complete session" });
    }
  });

  app.patch("/api/sessions/:id/cancel", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getWorkoutSession(req.params.id);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Only allow canceling pending sessions
      if (session.status !== 'pending') {
        return res.status(409).json({ 
          message: "Endast pågående pass kan avbrytas",
          currentStatus: session.status 
        });
      }

      await storage.cancelWorkoutSession(req.params.id);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel session" });
    }
  });

  // ========== EXERCISE LOG ROUTES ==========
  
  app.get("/api/sessions/:sessionId/exercises", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const session = await storage.getWorkoutSession(req.params.sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const exercises = await storage.getSessionExerciseLogs(req.params.sessionId);
      res.json(exercises);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exercises" });
    }
  });

  app.post("/api/exercises", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertExerciseLogSchema.parse(req.body);
      
      const session = await storage.getWorkoutSession(validatedData.workoutSessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const log = await storage.createExerciseLog(validatedData);
      res.json(log);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create exercise log" });
    }
  });

  app.patch("/api/exercises/:id", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const exerciseLog = await storage.getExerciseLog(req.params.id);
      
      if (!exerciseLog) {
        return res.status(404).json({ message: "Exercise log not found" });
      }
      
      const session = await storage.getWorkoutSession(exerciseLog.workoutSessionId);
      if (session?.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const validatedData = updateExerciseLogSchema.parse(req.body);
      await storage.updateExerciseLog(req.params.id, validatedData);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update exercise log" });
    }
  });

  const bulkUpdateSchema = z.object({
    weight: z.number().optional(),
    reps: z.number().optional(),
  });

  app.post("/api/sessions/:sessionId/exercises/:exerciseOrderIndex/bulk-update", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sessionId, exerciseOrderIndex } = req.params;
      
      const session = await storage.getWorkoutSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      if (session.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const validatedData = bulkUpdateSchema.parse(req.body);
      
      // Validate at least one field is provided
      if (!validatedData.weight && !validatedData.reps) {
        return res.status(400).json({ message: "At least one of weight or reps must be provided" });
      }
      
      const orderIndex = parseInt(exerciseOrderIndex, 10);
      if (isNaN(orderIndex) || orderIndex < 0) {
        return res.status(400).json({ message: "Invalid exercise order index" });
      }
      
      await storage.bulkUpdateExerciseLogs(sessionId, orderIndex, validatedData);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to bulk update exercise logs" });
    }
  });

  // ========== PROMO & MONETIZATION ROUTES ==========
  
  app.get("/api/promos/:placement", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedParams = promoPlacementParamSchema.parse(req.params);
      
      const promo = await promoService.getEligiblePromo({ userId, placement: validatedParams.placement });
      
      if (!promo) {
        return res.json(null);
      }
      
      res.json(promo);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to fetch promo" });
    }
  });

  app.post("/api/promos/:id/impression", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedParams = promoIdParamSchema.parse(req.params);
      const validatedBody = trackPromoImpressionSchema.parse(req.body);
      
      const promo = await storage.getPromo(validatedParams.id);
      if (!promo) {
        return res.status(404).json({ message: "Promo not found" });
      }
      
      await promoService.trackImpression(userId, validatedParams.id, validatedBody.placement, validatedBody.metadata);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to track impression" });
    }
  });

  app.post("/api/affiliate/click/:id", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedParams = promoIdParamSchema.parse(req.params);
      const validatedBody = trackAffiliateClickSchema.parse(req.body);
      
      const promo = await storage.getPromo(validatedParams.id);
      if (!promo || !promo.ctaUrl) {
        return res.status(404).json({ message: "Promo not found or has no URL" });
      }
      
      await promoService.trackClick(userId, validatedParams.id, promo.ctaUrl, validatedBody.metadata);
      
      res.json({ redirectUrl: promo.ctaUrl });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // ========== NOTIFICATION PREFERENCE ROUTES ==========
  
  app.get("/api/notification-preferences", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prefs = await storage.getNotificationPreferences(userId);
      res.json(prefs || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  app.post("/api/notification-preferences", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertNotificationPreferencesSchema.parse({
        ...req.body,
        userId,
      });
      const prefs = await storage.upsertNotificationPreferences(validatedData);
      res.json(prefs);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // ========== SUBSCRIPTION ROUTES ==========
  
  app.get("/api/subscription", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const subscription = await storage.getUserSubscription(userId);
      res.json(subscription || { status: "free" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // ========== TRAINING TIPS ROUTES ==========
  
  app.get("/api/tips", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const { category, workoutType, isActive } = req.query;
      
      const filters: { category?: string; workoutType?: string; isActive?: boolean } = {};
      
      if (category) {
        filters.category = String(category);
      }
      
      if (workoutType) {
        filters.workoutType = String(workoutType);
      }
      
      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }
      
      const tips = await storage.getTrainingTips(filters);
      res.json(tips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch training tips" });
    }
  });
  
  app.get("/api/tips/export", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const tips = await storage.getTrainingTips();
      
      const csvHeaders = "ID,Message,Category,Workout Types,Icon,Promo Placement,Active,Priority\n";
      const csvRows = tips.map(tip => {
        const workoutTypes = tip.workoutTypes.join(";");
        const message = `"${tip.message.replace(/"/g, '""')}"`;
        return `${tip.id},${message},${tip.category},${workoutTypes},${tip.icon},${tip.relatedPromoPlacement || ''},${tip.isActive},${tip.priority}`;
      }).join("\n");
      
      const csv = csvHeaders + csvRows;
      
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=training-tips.csv");
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Failed to export training tips" });
    }
  });

  // Personalized profile-based tips
  app.get("/api/tips/personalized", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(String(req.query.limit)) : 1;
      
      const tips = await storage.getPersonalizedTips(userId, limit);
      res.json(tips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch personalized tips" });
    }
  });

  // Personalized tips by category
  app.get("/api/tips/personalized/:category", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { category } = req.params;
      const limit = req.query.limit ? parseInt(String(req.query.limit)) : 10;
      
      const tips = await storage.getProfileTipsByCategory(userId, category, limit);
      res.json(tips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tips for category" });
    }
  });

  // ========== EXERCISE CATALOG ROUTES ==========
  
  // Get exercises suitable for a template (filtered by muscle focus)
  app.get("/api/exercises/for-template/:templateId", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { templateId } = req.params;
      
      const template = await storage.getProgramTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Verify ownership
      if (template.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Get all exercises from catalog
      const allExercises = await db.select().from(exercises);
      
      // Get currently used exercises in this template
      const templateExercises = await storage.getTemplateExercises(templateId);
      const currentExerciseNames = new Set(templateExercises.map(e => e.exerciseName));
      
      // Filter exercises that match template's muscle focus
      // Match by: primaryMuscles or secondaryMuscles containing keywords from muscleFocus
      const muscleFocusKeywords = (template.muscleFocus || "").toLowerCase().split(/[,\-&]/);
      
      const matchingExercises = allExercises.filter(ex => {
        // Skip if already in template
        if (currentExerciseNames.has(ex.name)) return false;
        
        const primaryMuscles = (ex.primaryMuscles || []).map(m => m.toLowerCase());
        const secondaryMuscles = (ex.secondaryMuscles || []).map(m => m.toLowerCase());
        const allMuscles = [...primaryMuscles, ...secondaryMuscles];
        
        // Check if any muscle matches any keyword
        return muscleFocusKeywords.some(keyword => 
          keyword.trim() && allMuscles.some(muscle => muscle.includes(keyword.trim()))
        );
      });
      
      res.json(matchingExercises);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exercises" });
    }
  });

  app.get("/api/exercises/videos", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const namesParam = req.query.names;
      
      if (!namesParam) {
        return res.status(400).json({ message: "Exercise names are required" });
      }
      
      const exerciseNames = Array.isArray(namesParam) 
        ? namesParam.map(n => String(n).trim()).filter(Boolean)
        : String(namesParam).split(',').map(n => n.trim()).filter(Boolean);
      
      if (exerciseNames.length === 0) {
        return res.json({});
      }
      
      const exercises = await storage.getExercisesByNames(exerciseNames);
      
      const videoMap: Record<string, { youtubeUrl: string | null; videoType: string | null }> = {};
      exerciseNames.forEach(name => {
        const exercise = exercises.find(e => e.name === name || e.nameEn === name);
        videoMap[name] = {
          youtubeUrl: exercise?.youtubeUrl ?? null,
          videoType: exercise?.videoType ?? null,
        };
      });
      
      res.json(videoMap);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exercise videos" });
    }
  });
  
  app.get("/api/exercises/video", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const exerciseName = req.query.name as string;
      
      if (!exerciseName) {
        return res.status(400).json({ message: "Exercise name is required" });
      }
      
      const exercise = await storage.getExerciseByName(exerciseName);
      
      if (!exercise) {
        return res.json({ youtubeUrl: null, videoType: null });
      }
      
      res.json({ 
        youtubeUrl: exercise.youtubeUrl,
        videoType: exercise.videoType,
        name: exercise.name,
        nameEn: exercise.nameEn,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exercise video" });
    }
  });

  app.get("/api/exercises/export", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const allExercises = await db
        .select({
          swedish: exercises.name,
          english: exercises.nameEn,
          youtubeUrl: exercises.youtubeUrl,
          videoType: exercises.videoType,
        })
        .from(exercises);

      // Sort with Swedish locale for proper å, ä, ö ordering
      allExercises.sort((a, b) => 
        a.swedish.localeCompare(b.swedish, 'sv-SE', { sensitivity: 'base' })
      );

      // Helper function to escape CSV fields
      const escapeCsvField = (field: string | null): string => {
        if (!field) return '';
        // Escape double quotes by doubling them
        const escaped = field.replace(/"/g, '""');
        // Wrap in quotes if contains comma, quote, or newline
        if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
          return `"${escaped}"`;
        }
        return escaped;
      };

      const csvHeader = 'Övning (Svenska),Övning (English),Video-länk,Video-typ\n';
      const csvRows = allExercises.map(ex => {
        return [
          escapeCsvField(ex.swedish),
          escapeCsvField(ex.english),
          escapeCsvField(ex.youtubeUrl),
          escapeCsvField(ex.videoType),
        ].join(',');
      }).join('\n');

      const csv = csvHeader + csvRows;

      const today = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=repcompanion-ovningar-${today}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Failed to export exercises" });
    }
  });

  // ========== HEALTH INTEGRATION (VITAL API) ==========
  
  // Generate Link token for Vital Link Widget OAuth flow
  app.post("/api/health/connect", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const linkToken = await vitalService.generateLinkToken(userId);
      
      res.json({
        success: true,
        linkToken: linkToken.link_token,
        linkUrl: linkToken.link_web_url,
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        message: "Failed to generate connection link",
        error: error.message 
      });
    }
  });

  // Webhook endpoint for Vital to push health data
  app.post("/api/health/webhook", async (req: any, res) => {
    try {
      const signature = req.headers['x-vital-signature'] as string;
      const webhookSecret = process.env.VITAL_WEBHOOK_SECRET;

      // Verify webhook signature if secret is configured
      if (webhookSecret && signature) {
        const payload = JSON.stringify(req.body);
        const isValid = vitalService.verifyWebhookSignature(payload, signature, webhookSecret);
        
        if (!isValid) {
          return res.status(401).json({ message: "Invalid signature" });
        }
      }

      // Process webhook data asynchronously
      vitalService.processWebhookData(req.body).catch(error => {
      });

      // Acknowledge webhook immediately
      res.status(200).json({ received: true });
    } catch (error: any) {
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Get user's health connections
  app.get("/api/health/connections", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const connections = await db
        .select({
          id: healthConnections.id,
          platform: healthConnections.platform,
          status: healthConnections.status,
          connectedAt: healthConnections.connectedAt,
          lastSyncAt: healthConnections.lastSyncAt,
        })
        .from(healthConnections)
        .where(eq(healthConnections.userId, userId))
        .orderBy(desc(healthConnections.connectedAt));

      res.json(connections);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // Disconnect a health platform
  app.delete("/api/health/connections/:platform", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const platform = req.params.platform;

      await vitalService.disconnectProvider(userId, platform);

      res.json({ success: true, message: `Disconnected ${platform}` });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: "Failed to disconnect platform",
        error: error.message 
      });
    }
  });

  // Get health metrics for a date range
  app.get("/api/health/metrics", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate, metricType } = req.query;

      // Build filter conditions array
      const conditions = [eq(healthMetrics.userId, userId)];

      // Add date range filter if provided
      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        conditions.push(gte(healthMetrics.date, start));
        conditions.push(lte(healthMetrics.date, end));
      }

      // Add metric type filter if provided
      if (metricType) {
        conditions.push(eq(healthMetrics.metricType, metricType as string));
      }

      const metrics = await db
        .select()
        .from(healthMetrics)
        .where(and(...conditions))
        .orderBy(desc(healthMetrics.date));

      // Group metrics by type for easier consumption
      const groupedMetrics = metrics.reduce((acc: any, metric: any) => {
        if (!acc[metric.metricType]) {
          acc[metric.metricType] = [];
        }
        acc[metric.metricType].push({
          value: metric.value,
          unit: metric.unit,
          date: metric.date,
          collectedAt: metric.collectedAt,
        });
        return acc;
      }, {});

      res.json({
        raw: metrics,
        grouped: groupedMetrics,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch health metrics" });
    }
  });

  // Get latest metrics summary (today's data)
  app.get("/api/health/metrics/today", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayMetrics = await db
        .select()
        .from(healthMetrics)
        .where(and(
          eq(healthMetrics.userId, userId),
          gte(healthMetrics.date, today)
        ))
        .orderBy(desc(healthMetrics.collectedAt));

      // Transform to object for easy access
      const summary: any = {};
      todayMetrics.forEach((metric: any) => {
        summary[metric.metricType] = {
          value: metric.value,
          unit: metric.unit,
          collectedAt: metric.collectedAt,
        };
      });

      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch today's metrics" });
    }
  });

  // Get body data from Vital API (weight, height, birthdate)
  app.get("/api/health/body-data", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bodyData = await vitalService.getBodyData(userId);
      
      if (!bodyData) {
        return res.json({
          weight: null,
          height: null,
          birthdate: null,
        });
      }

      res.json(bodyData);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch body data from Vital" });
    }
  });

  // ========== PROGRESS & STATS ROUTES ==========

  app.get("/api/stats/progress", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get all completed sessions
      const sessions = await storage.getUserWorkoutSessions(userId, 1000);

      // Get all exercise logs in one query for ALL sessions (avoid N+1)
      const allLogs = await db
        .select()
        .from(exerciseLogs)
        .innerJoin(workoutSessions, eq(exerciseLogs.workoutSessionId, workoutSessions.id))
        .where(eq(workoutSessions.userId, userId));

      // Group logs by session ID
      const logsBySessionId = new Map<string, ExerciseLog[]>();
      allLogs.forEach(({ exercise_logs }) => {
        const logs = logsBySessionId.get(exercise_logs.workoutSessionId) || [];
        logs.push(exercise_logs);
        logsBySessionId.set(exercise_logs.workoutSessionId, logs);
      });

      // Extract just the logs for easier calculation
      const allExerciseLogs: ExerciseLog[] = allLogs.map(row => row.exercise_logs);

      // Calculate summary stats
      const totalSessions = sessions.length;
      const totalVolume = allExerciseLogs.reduce((sum, log) => {
        return sum + ((log.weight || 0) * (log.reps || 0));
      }, 0);

      // Unique exercises
      const uniqueExercises = new Set<string>();
      allExerciseLogs.forEach((log) => {
        uniqueExercises.add(log.exerciseTitle);
      });

      // Average session duration
      const avgDuration = sessions.length > 0
        ? Math.round(
            sessions.reduce((sum, s) => {
              if (s.completedAt && s.startedAt) {
                const duration = (new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / (1000 * 60);
                return sum + duration;
              }
              return sum;
            }, 0) / sessions.length
          )
        : 0;

      // Weekly trend (last 12 weeks)
      const weeklySessionsTrend = [];
      const weekMap = new Map<string, number>();
      
      sessions.forEach((session) => {
        const date = new Date(session.startedAt);
        const week = `W${Math.ceil((date.getDate() + 1) / 7)}`;
        weekMap.set(week, (weekMap.get(week) || 0) + 1);
      });

      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i * 7);
        const week = `W${Math.ceil((date.getDate() + 1) / 7)}`;
        weeklySessionsTrend.push({
          week: date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }),
          sessions: weekMap.get(week) || 0,
        });
      }

      // Top exercises
      const exerciseMap = new Map<string, { volume: number; count: number }>();
      allExerciseLogs.forEach((log) => {
        const current = exerciseMap.get(log.exerciseTitle) || { volume: 0, count: 0 };
        current.volume += (log.weight || 0) * (log.reps || 0);
        current.count += 1;
        exerciseMap.set(log.exerciseTitle, current);
      });

      const topExercises = Array.from(exerciseMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 10);

      // Strength progress for compound lifts
      const strengthProgress: any[] = [];
      const compoundLiftNames = [
        "Squat", "Bänkpress", "Dödlyft", "Marklyft",
        "Lat Pull-Down", "Rad",
      ];

      compoundLiftNames.forEach((liftName) => {
        const liftLogs = allExerciseLogs
          .filter((log) => log.exerciseTitle.toLowerCase().includes(liftName.toLowerCase()))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (liftLogs.length > 0) {
          const weights = liftLogs.map((log) => ({
            date: new Date(log.createdAt).toLocaleDateString('sv-SE'),
            weight: log.weight || 0,
            reps: log.reps || 0,
          }));

          const maxWeight = Math.max(...weights.map((w) => w.weight));
          const avgWeight = weights.reduce((sum, w) => sum + w.weight, 0) / weights.length;

          strengthProgress.push({
            exercise: liftName,
            weights: weights.slice(-20), // Last 20 logs
            totalSets: liftLogs.length,
            totalVolume: liftLogs.reduce((sum, log) => sum + ((log.weight || 0) * (log.reps || 0)), 0),
            avgWeight: Math.round(avgWeight),
            maxWeight,
          });
        }
      });

      res.json({
        totalSessions,
        totalVolume,
        totalExercises: uniqueExercises.size,
        averageSessionDuration: avgDuration,
        weeklySessionsTrend,
        topExercises,
        strengthProgress,
      });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch progress stats" });
    }
  });

  // ========== ADMIN ROUTES ==========
  
  app.get("/api/admin/unmapped-exercises", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const { getUnmappedExercises } = await import("./exercise-matcher");
      const unmappedExercises = await getUnmappedExercises();
      res.json(unmappedExercises);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unmapped exercises" });
    }
  });



  /**
   * Resolve an unmapped exercise
   * action: "alias" | "new" | "reject"
   */
  app.patch("/api/admin/unmapped-exercises/:id/resolve", isAuthenticatedOrDev, async (req: any, res) => {
    const { id } = req.params;
    const { action, exerciseId, newName, note } = req.body || {};

    if (!action || !["alias", "new", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use alias | new | reject" });
    }

    try {
      const entry = await db
        .select()
        .from(unmappedExercises)
        .where(eq(unmappedExercises.id, id))
        .limit(1);

      if (entry.length === 0) {
        return res.status(404).json({ message: "Unmapped exercise not found" });
      }

      const aiName = entry[0].aiName;

      if (action === "alias") {
        if (!exerciseId) {
          return res.status(400).json({ message: "exerciseId is required for alias action" });
        }

        const existingAlias = await db
          .select()
          .from(exerciseAliases)
          .where(
            sql`${exerciseAliases.aliasName} = ${aiName} AND ${exerciseAliases.exerciseId} = ${exerciseId}`
          )
          .limit(1);

        if (existingAlias.length === 0) {
          await db.insert(exerciseAliases).values({
            aliasName: aiName,
            exerciseId,
            createdBy: req.user?.claims?.sub,
          });
        }

        await db.delete(unmappedExercises).where(eq(unmappedExercises.id, id));
        return res.json({ resolvedAs: "alias", aiName, exerciseId });
      }

      if (action === "new") {
        if (!newName) {
          return res.status(400).json({ message: "newName is required for new action" });
        }

        const [created] = await db
          .insert(exercises)
          .values({
            name: newName,
            nameEn: newName,
            category: "strength",
            difficulty: "intermediate",
            primaryMuscles: ["unknown"],
            secondaryMuscles: [],
            requiredEquipment: ["unknown"],
            isCompound: false,
            youtubeUrl: null,
            videoType: null,
          })
          .returning();

        await db.insert(exerciseAliases).values({
          aliasName: aiName,
          exerciseId: created.id,
          createdBy: req.user?.claims?.sub,
        });

        await db.delete(unmappedExercises).where(eq(unmappedExercises.id, id));
        return res.json({ resolvedAs: "new", aiName, exerciseId: created.id });
      }

      if (action === "reject") {
        await db.delete(unmappedExercises).where(eq(unmappedExercises.id, id));
        return res.json({ resolvedAs: "rejected", aiName, note: note || null });
      }

      return res.status(400).json({ message: "Unhandled action" });
    } catch (error) {
      console.error("[ADMIN] Failed to resolve unmapped exercise:", error);
      return res.status(500).json({ message: "Failed to resolve unmapped exercise" });
    }
  });

  // Unmapped equipment inbox
  app.get("/api/admin/unmapped-equipment", isAuthenticatedOrDev, async (_req: any, res) => {
    try {
      const entries = await db.select().from(unmappedEquipment).orderBy(sql`${unmappedEquipment.count} DESC`);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unmapped equipment" });
    }
  });

  /**
   * Resolve an unmapped equipment
   * action: "alias" | "new" | "reject"
   */
  app.patch("/api/admin/unmapped-equipment/:id/resolve", isAuthenticatedOrDev, async (req: any, res) => {
    const { id } = req.params;
    const { action, equipmentId, newName, note } = req.body || {};

    if (!action || !["alias", "new", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use alias | new | reject" });
    }

    try {
      const entry = await db
        .select()
        .from(unmappedEquipment)
        .where(eq(unmappedEquipment.id, id))
        .limit(1);

      if (entry.length === 0) {
        return res.status(404).json({ message: "Unmapped equipment not found" });
      }

      const aiName = entry[0].aiName;

      if (action === "alias") {
        if (!equipmentId) {
          return res.status(400).json({ message: "equipmentId is required for alias action" });
        }

        const existingAlias = await db
          .select()
          .from(equipmentAliases)
          .where(
            sql`${equipmentAliases.aliasName} = ${aiName} AND ${equipmentAliases.equipmentId} = ${equipmentId}`
          )
          .limit(1);

        if (existingAlias.length === 0) {
          await db.insert(equipmentAliases).values({
            aliasName: aiName,
            equipmentId,
            createdBy: req.user?.claims?.sub,
          });
        }

        await db.delete(unmappedEquipment).where(eq(unmappedEquipment.id, id));
        return res.json({ resolvedAs: "alias", aiName, equipmentId });
      }

      if (action === "new") {
        if (!newName) {
          return res.status(400).json({ message: "newName is required for new action" });
        }

        const [created] = await db
          .insert(equipmentCatalog)
          .values({
            name: newName,
            nameEn: newName,
            category: "Other",
            type: "Other",
            description: null,
          })
          .returning();

        await db.insert(equipmentAliases).values({
          aliasName: aiName,
          equipmentId: created.id,
          createdBy: req.user?.claims?.sub,
        });

        await db.delete(unmappedEquipment).where(eq(unmappedEquipment.id, id));
        return res.json({ resolvedAs: "new", aiName, equipmentId: created.id });
      }

      if (action === "reject") {
        await db.delete(unmappedEquipment).where(eq(unmappedEquipment.id, id));
        return res.json({ resolvedAs: "rejected", aiName, note: note || null });
      }

      return res.status(400).json({ message: "Unhandled action" });
    } catch (error) {
      console.error("[ADMIN] Failed to resolve unmapped equipment:", error);
      return res.status(500).json({ message: "Failed to resolve unmapped equipment" });
    }
  });

  // Log unmapped equipment from clients
  app.post("/api/equipment/unmapped", isAuthenticatedOrDev, async (req: any, res) => {
    const { aiName, suggestedMatch } = req.body || {};
    if (!aiName) {
      return res.status(400).json({ message: "aiName is required" });
    }

    try {
      const existing = await db
        .select()
        .from(unmappedEquipment)
        .where(eq(unmappedEquipment.aiName, aiName))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(unmappedEquipment)
          .set({
            count: sql`${unmappedEquipment.count} + 1`,
            lastSeen: new Date(),
            suggestedMatch: suggestedMatch || existing[0].suggestedMatch,
          })
          .where(eq(unmappedEquipment.aiName, aiName));
      } else {
        await db.insert(unmappedEquipment).values({
          aiName,
          suggestedMatch: suggestedMatch || null,
          count: 1,
          firstSeen: new Date(),
          lastSeen: new Date(),
        });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("[API] Failed to log unmapped equipment:", error);
      res.status(500).json({ message: "Failed to log unmapped equipment" });
    }
  });

  // ========== PENDING ITEMS ENDPOINTS (iOS AdminView compatible) ==========
  // These map to unmapped_exercises and unmapped_equipment tables
  // with response format matching iOS PendingExercise/PendingEquipment structs

  // GET all pending exercises for admin review
  app.get("/api/admin/pending/exercises", isAuthenticatedOrDev, async (_req: any, res) => {
    try {
      const entries = await db
        .select()
        .from(unmappedExercises)
        .orderBy(sql`${unmappedExercises.count} DESC`);
      
      // Transform to iOS PendingExercise format
      const pendingExercises = entries.map(entry => ({
        id: entry.id,
        name: entry.aiName,
        nameEn: entry.suggestedMatch || null,
        description: null,
        category: null,
        difficulty: null,
        primaryMuscles: null,
        secondaryMuscles: null,
        requiredEquipment: null,
        movementPattern: null,
        isCompound: null,
        youtubeUrl: null,
        videoType: null,
        instructions: null,
        createdBy: "system",
        aiGeneratedName: entry.aiName,
        status: "pending",
        reviewedBy: entry.matchedExerciseId ? "admin" : null,
        reviewedAt: null,
        rejectionReason: null,
        createdAt: entry.firstSeen?.toISOString() || new Date().toISOString(),
        // Extra info for admin
        count: entry.count,
        lastSeen: entry.lastSeen?.toISOString() || null,
      }));
      
      res.json(pendingExercises);
    } catch (error) {
      console.error("[ADMIN] Failed to fetch pending exercises:", error);
      res.status(500).json({ message: "Failed to fetch pending exercises" });
    }
  });

  // GET all pending equipment for admin review
  app.get("/api/admin/pending/equipment", isAuthenticatedOrDev, async (_req: any, res) => {
    try {
      const entries = await db
        .select()
        .from(unmappedEquipment)
        .orderBy(sql`${unmappedEquipment.count} DESC`);
      
      // Transform to iOS PendingEquipment format
      const pendingEquipment = entries.map(entry => ({
        id: entry.id,
        name: entry.aiName,
        nameEn: entry.suggestedMatch || null,
        category: null,
        type: null,
        description: null,
        createdBy: "system",
        aiGeneratedName: entry.aiName,
        status: "pending",
        reviewedBy: entry.matchedEquipmentId ? "admin" : null,
        reviewedAt: null,
        rejectionReason: null,
        createdAt: entry.firstSeen?.toISOString() || new Date().toISOString(),
        // Extra info for admin
        count: entry.count,
        lastSeen: entry.lastSeen?.toISOString() || null,
      }));
      
      res.json(pendingEquipment);
    } catch (error) {
      console.error("[ADMIN] Failed to fetch pending equipment:", error);
      res.status(500).json({ message: "Failed to fetch pending equipment" });
    }
  });

  // Approve a pending exercise (creates alias to existing exercise)
  app.post("/api/admin/pending/exercises/:id/approve", isAuthenticatedOrDev, async (req: any, res) => {
    const { id } = req.params;
    const { exerciseId, newName } = req.body || {};
    
    try {
      const [entry] = await db
        .select()
        .from(unmappedExercises)
        .where(eq(unmappedExercises.id, id))
        .limit(1);
      
      if (!entry) {
        return res.status(404).json({ message: "Pending exercise not found" });
      }
      
      const aiName = entry.aiName;
      
      if (exerciseId) {
        // Create alias to existing exercise
        const existingAlias = await db
          .select()
          .from(exerciseAliases)
          .where(sql`${exerciseAliases.aliasName} = ${aiName} AND ${exerciseAliases.exerciseId} = ${exerciseId}`)
          .limit(1);
        
        if (existingAlias.length === 0) {
          await db.insert(exerciseAliases).values({
            aliasName: aiName,
            exerciseId,
            createdBy: req.user?.claims?.sub,
          });
        }
        
        await db.delete(unmappedExercises).where(eq(unmappedExercises.id, id));
        
        // Fetch the linked exercise to return
        const [linkedExercise] = await db
          .select()
          .from(exercises)
          .where(eq(exercises.id, exerciseId))
          .limit(1);
        
        return res.json({
          id: linkedExercise?.id || exerciseId,
          name: linkedExercise?.name || aiName,
          nameEn: linkedExercise?.nameEn || null,
          resolvedAs: "alias",
        });
      } else if (newName) {
        // Create new exercise in catalog
        const [created] = await db
          .insert(exercises)
          .values({
            name: newName,
            nameEn: newName,
            category: "Other",
            difficulty: "Intermediate",
            primaryMuscles: [],
            requiredEquipment: [],
            isCompound: false,
          })
          .returning();
        
        await db.insert(exerciseAliases).values({
          aliasName: aiName,
          exerciseId: created.id,
          createdBy: req.user?.claims?.sub,
        });
        
        await db.delete(unmappedExercises).where(eq(unmappedExercises.id, id));
        
        return res.json({
          id: created.id,
          name: created.name,
          nameEn: created.nameEn,
          resolvedAs: "new",
        });
      } else {
        return res.status(400).json({ message: "Either exerciseId or newName is required" });
      }
    } catch (error) {
      console.error("[ADMIN] Failed to approve pending exercise:", error);
      res.status(500).json({ message: "Failed to approve pending exercise" });
    }
  });

  // Reject a pending exercise
  app.post("/api/admin/pending/exercises/:id/reject", isAuthenticatedOrDev, async (req: any, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    
    try {
      const [entry] = await db
        .select()
        .from(unmappedExercises)
        .where(eq(unmappedExercises.id, id))
        .limit(1);
      
      if (!entry) {
        return res.status(404).json({ message: "Pending exercise not found" });
      }
      
      await db.delete(unmappedExercises).where(eq(unmappedExercises.id, id));
      
      console.log(`[ADMIN] Rejected pending exercise: "${entry.aiName}" - Reason: ${reason || "No reason provided"}`);
      
      res.json({ success: true, id, reason: reason || null });
    } catch (error) {
      console.error("[ADMIN] Failed to reject pending exercise:", error);
      res.status(500).json({ message: "Failed to reject pending exercise" });
    }
  });

  // Approve a pending equipment
  app.post("/api/admin/pending/equipment/:id/approve", isAuthenticatedOrDev, async (req: any, res) => {
    const { id } = req.params;
    const { equipmentId, newName } = req.body || {};
    
    try {
      const [entry] = await db
        .select()
        .from(unmappedEquipment)
        .where(eq(unmappedEquipment.id, id))
        .limit(1);
      
      if (!entry) {
        return res.status(404).json({ message: "Pending equipment not found" });
      }
      
      const aiName = entry.aiName;
      
      if (equipmentId) {
        // Create alias to existing equipment
        const existingAlias = await db
          .select()
          .from(equipmentAliases)
          .where(sql`${equipmentAliases.aliasName} = ${aiName} AND ${equipmentAliases.equipmentId} = ${equipmentId}`)
          .limit(1);
        
        if (existingAlias.length === 0) {
          await db.insert(equipmentAliases).values({
            aliasName: aiName,
            equipmentId,
            createdBy: req.user?.claims?.sub,
          });
        }
        
        await db.delete(unmappedEquipment).where(eq(unmappedEquipment.id, id));
        
        // Fetch the linked equipment to return
        const [linkedEquipment] = await db
          .select()
          .from(equipmentCatalog)
          .where(eq(equipmentCatalog.id, equipmentId))
          .limit(1);
        
        return res.json({
          id: linkedEquipment?.id || equipmentId,
          name: linkedEquipment?.name || aiName,
          nameEn: linkedEquipment?.nameEn || null,
          resolvedAs: "alias",
        });
      } else if (newName) {
        // Create new equipment in catalog
        const [created] = await db
          .insert(equipmentCatalog)
          .values({
            name: newName,
            nameEn: newName,
            category: "Other",
            type: "Other",
            description: null,
          })
          .returning();
        
        await db.insert(equipmentAliases).values({
          aliasName: aiName,
          equipmentId: created.id,
          createdBy: req.user?.claims?.sub,
        });
        
        await db.delete(unmappedEquipment).where(eq(unmappedEquipment.id, id));
        
        return res.json({
          id: created.id,
          name: created.name,
          nameEn: created.nameEn,
          resolvedAs: "new",
        });
      } else {
        return res.status(400).json({ message: "Either equipmentId or newName is required" });
      }
    } catch (error) {
      console.error("[ADMIN] Failed to approve pending equipment:", error);
      res.status(500).json({ message: "Failed to approve pending equipment" });
    }
  });

  // Reject a pending equipment
  app.post("/api/admin/pending/equipment/:id/reject", isAuthenticatedOrDev, async (req: any, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    
    try {
      const [entry] = await db
        .select()
        .from(unmappedEquipment)
        .where(eq(unmappedEquipment.id, id))
        .limit(1);
      
      if (!entry) {
        return res.status(404).json({ message: "Pending equipment not found" });
      }
      
      await db.delete(unmappedEquipment).where(eq(unmappedEquipment.id, id));
      
      console.log(`[ADMIN] Rejected pending equipment: "${entry.aiName}" - Reason: ${reason || "No reason provided"}`);
      
      res.json({ success: true, id, reason: reason || null });
    } catch (error) {
      console.error("[ADMIN] Failed to reject pending equipment:", error);
      res.status(500).json({ message: "Failed to reject pending equipment" });
    }
  });
  app.get("/api/admin/exercises/export-csv", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      // Get all exercises with usage count from exercise_logs
      const exercisesWithUsage = await db
        .select({
          id: exercises.id,
          swedish: exercises.name,
          english: exercises.nameEn,
          youtubeUrl: exercises.youtubeUrl,
          videoType: exercises.videoType,
          usageCount: sql<number>`COUNT(${exerciseLogs.id})`.as('usage_count'),
        })
        .from(exercises)
        .leftJoin(
          exerciseLogs,
          eq(exercises.name, exerciseLogs.exerciseTitle)
        )
        .groupBy(exercises.id)
        .orderBy(sql`COUNT(${exerciseLogs.id}) DESC`);

      // Format as CSV
      const csvHeader = 'Swedish,English,YouTube URL,Video Type,Usage Count,Status\n';
      const csvRows = exercisesWithUsage.map(ex => {
        const hasVideo = ex.youtubeUrl ? 'Has Video' : 'Missing Video';
        const videoType = ex.videoType || 'N/A';
        const english = ex.english || 'N/A';
        const youtubeUrl = ex.youtubeUrl || 'N/A';
        
        return `"${ex.swedish}","${english}","${youtubeUrl}","${videoType}",${ex.usageCount},"${hasVideo}"`;
      }).join('\n');

      const csv = csvHeader + csvRows;

      // Set CSV headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=exercises-usage.csv');
      res.send(csv);
    } catch (error) {
      res.status(500).json({ message: "Failed to export exercises CSV" });
    }
  });

  // ==========iOS APP API ENDPOINTS ==========
  
  // Get exercise catalog for iOS app
  app.get("/api/exercises/catalog", async (req, res) => {
    try {
      const allExercises = await db
        .select()
        .from(exercises)
        .orderBy(exercises.name);
      
      res.json(allExercises);
    } catch (error) {
      console.error("Exercise catalog error:", error);
      res.status(500).json({ message: "Failed to fetch exercise catalog" });
    }
  });

  // Get equipment catalog for iOS app
  app.get("/api/equipment/catalog", async (req, res) => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`[BACKEND] Received /api/equipment/catalog request at ${new Date().toISOString()}`);
    const startTime = Date.now();
    try {
      const allEquipment = await db.select().from(equipmentCatalog);
      console.log(`[BACKEND] Found ${allEquipment.length} equipment items in database.`);
      if (allEquipment.length > 0) {
        console.log(`[BACKEND] First 5 items: ${JSON.stringify(allEquipment.slice(0, 5))}`);
      } else {
        console.log("[BACKEND] Database is empty for equipment catalog.");
      }
      res.json(allEquipment);
      const duration = Date.now() - startTime;
      console.log(`[BACKEND] /api/equipment/catalog completed in ${duration}ms`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[BACKEND] Error fetching equipment catalog after ${duration}ms:`, error);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      res.status(500).json({ message: "Failed to fetch equipment catalog" });
    }
  });

  // Get gym programs for iOS app
  app.get("/api/gym-programs", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Get all user's gyms and their programs
      const gyms = await storage.getUserGyms(userId);
      const programs = await Promise.all(
        gyms.map(async (gym) => {
          const program = await storage.getGymProgram(userId, gym.id);
          return program ? { gymId: gym.id, gymName: gym.name, program } : null;
        })
      );
      res.json(programs.filter(Boolean));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gym programs" });
    }
  });

  // Track unmapped exercises from iOS app
  app.post("/api/exercises/unmapped", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const { aiName, suggestedMatch } = req.body;
      
      if (!aiName) {
        return res.status(400).json({ message: "aiName is required" });
      }

      // Log the unmapped exercise for admin review
      console.log(`[UNMAPPED EXERCISE] AI: "${aiName}", Suggested: "${suggestedMatch || 'none'}"`);
      
      // TODO: Store in database table for admin review
      // For now, just log it
      
      res.json({ 
        success: true, 
        message: "Unmapped exercise tracked"
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to track unmapped exercise" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to calculate suggested training goals
function calculateSuggestedGoals(input: {
  motivationType?: string;
  trainingLevel?: string;
  age?: number;
  sex?: string;
  bodyWeight?: number;
  height?: number;
  oneRmValues: {
    oneRmBench: number | null;
    oneRmOhp: number | null;
    oneRmDeadlift: number | null;
    oneRmSquat: number | null;
    oneRmLatpull: number | null;
  };
}): { goalStrength: number; goalVolume: number; goalEndurance: number; goalCardio: number } {
  let strength = 25;
  let volume = 25;
  let endurance = 25;
  let cardio = 25;

  // Base distribution on motivationType
  switch (input.motivationType) {
    case "viktminskning":
      cardio = 40;
      endurance = 30;
      strength = 20;
      volume = 10;
      break;
    case "rehabilitering":
      strength = 30;
      endurance = 40;
      volume = 20;
      cardio = 10;
      break;
    case "hälsa_livsstil":
      endurance = 35;
      cardio = 35;
      strength = 20;
      volume = 10;
      break;
    case "sport":
      strength = 35;
      endurance = 30;
      volume = 20;
      cardio = 15;
      break;
    case "fitness":
    default:
      // Default balanced distribution
      strength = 30;
      volume = 30;
      endurance = 25;
      cardio = 15;
      break;
  }

  // Adjust based on training level
  if (input.trainingLevel === "nybörjare") {
    strength = Math.max(15, strength - 10);
    volume = Math.max(10, volume - 10);
    endurance += 10;
    cardio += 10;
  } else if (input.trainingLevel === "mycket_van" || input.trainingLevel === "elit") {
    strength += 10;
    volume += 5;
    endurance = Math.max(15, endurance - 10);
    cardio = Math.max(10, cardio - 5);
  }

  // Adjust based on 1RM values (high values = more strength/volume focus)
  const oneRmValues = [
    input.oneRmValues.oneRmBench,
    input.oneRmValues.oneRmOhp,
    input.oneRmValues.oneRmDeadlift,
    input.oneRmValues.oneRmSquat,
  ].filter((v): v is number => v !== null && v > 0);

  if (oneRmValues.length > 0) {
    const avgOneRm = oneRmValues.reduce((a, b) => a + b, 0) / oneRmValues.length;

    if (avgOneRm > 100) {
      // Strong person - focus more on strength and volume
      strength += 10;
      volume += 5;
      endurance = Math.max(15, endurance - 10);
      cardio = Math.max(10, cardio - 5);
    } else if (avgOneRm < 50 && oneRmValues.length >= 2) {
      // Beginner/weak - more balanced with endurance
      strength = Math.max(15, strength - 5);
      volume = Math.max(10, volume - 5);
      endurance += 5;
      cardio += 5;
    }
  }

  // Adjust based on age (older = more endurance/cardio focus)
  if (input.age && input.age > 50) {
    strength = Math.max(15, strength - 5);
    volume = Math.max(10, volume - 5);
    endurance += 5;
    cardio += 5;
  }

  // Normalize to 100%
  const total = strength + volume + endurance + cardio;
  const normalized = {
    goalStrength: Math.round((strength / total) * 100),
    goalVolume: Math.round((volume / total) * 100),
    goalEndurance: Math.round((endurance / total) * 100),
    goalCardio: Math.round((cardio / total) * 100),
  };

  // Final check to ensure sum is exactly 100
  const sum = normalized.goalStrength + normalized.goalVolume + normalized.goalEndurance + normalized.goalCardio;
  if (sum !== 100) {
    const diff = 100 - sum;
    normalized.goalStrength += diff; // Add difference to strength
  }

  return normalized;
}

// Helper function to calculate suggested 1RM values
function calculateSuggestedOneRm(input: {
  motivationType?: string;
  trainingLevel?: string;
  age: number;
  sex: string;
  bodyWeight: number;
  height: number;
}): {
  oneRmBench: number;
  oneRmOhp: number;
  oneRmDeadlift: number;
  oneRmSquat: number;
  oneRmLatpull: number;
} {
  // Base multipliers based on body weight
  // Typical ratios: Bench ~1.0x, OHP ~0.6x, Deadlift ~1.8x, Squat ~1.5x, Latpull ~0.8x
  let benchMultiplier = 1.0;
  let ohpMultiplier = 0.6;
  let deadliftMultiplier = 1.8;
  let squatMultiplier = 1.5;
  let latpullMultiplier = 0.8;

  // Adjust based on sex
  if (input.sex === "kvinna" || input.sex === "woman" || input.sex === "female") {
    benchMultiplier *= 0.7;
    ohpMultiplier *= 0.7;
    deadliftMultiplier *= 0.75;
    squatMultiplier *= 0.75;
    latpullMultiplier *= 0.7;
  }

  // Adjust based on training level
  switch (input.trainingLevel) {
    case "nybörjare":
      benchMultiplier *= 0.5;
      ohpMultiplier *= 0.5;
      deadliftMultiplier *= 0.5;
      squatMultiplier *= 0.5;
      latpullMultiplier *= 0.5;
      break;
    case "van":
      benchMultiplier *= 0.75;
      ohpMultiplier *= 0.75;
      deadliftMultiplier *= 0.75;
      squatMultiplier *= 0.75;
      latpullMultiplier *= 0.75;
      break;
    case "mycket_van":
      benchMultiplier *= 1.0;
      ohpMultiplier *= 1.0;
      deadliftMultiplier *= 1.0;
      squatMultiplier *= 1.0;
      latpullMultiplier *= 1.0;
      break;
    case "elit":
      benchMultiplier *= 1.3;
      ohpMultiplier *= 1.3;
      deadliftMultiplier *= 1.3;
      squatMultiplier *= 1.3;
      latpullMultiplier *= 1.3;
      break;
  }

  // Adjust based on motivation type
  switch (input.motivationType) {
    case "viktminskning":
      // Lower strength focus
      benchMultiplier *= 0.8;
      ohpMultiplier *= 0.8;
      deadliftMultiplier *= 0.8;
      squatMultiplier *= 0.8;
      latpullMultiplier *= 0.8;
      break;
    case "sport":
      // Higher strength focus
      benchMultiplier *= 1.1;
      ohpMultiplier *= 1.1;
      deadliftMultiplier *= 1.1;
      squatMultiplier *= 1.1;
      latpullMultiplier *= 1.1;
      break;
  }

  // Adjust based on age (older = lower strength)
  if (input.age > 50) {
    const ageFactor = Math.max(0.7, 1 - (input.age - 50) * 0.01);
    benchMultiplier *= ageFactor;
    ohpMultiplier *= ageFactor;
    deadliftMultiplier *= ageFactor;
    squatMultiplier *= ageFactor;
    latpullMultiplier *= ageFactor;
  }

  // Calculate 1RM values (rounded to nearest 5kg)
  const roundTo5 = (value: number) => Math.round(value / 5) * 5;

  return {
    oneRmBench: Math.max(20, roundTo5(input.bodyWeight * benchMultiplier)),
    oneRmOhp: Math.max(15, roundTo5(input.bodyWeight * ohpMultiplier)),
    oneRmDeadlift: Math.max(30, roundTo5(input.bodyWeight * deadliftMultiplier)),
    oneRmSquat: Math.max(25, roundTo5(input.bodyWeight * squatMultiplier)),
    oneRmLatpull: Math.max(20, roundTo5(input.bodyWeight * latpullMultiplier)),
  };
}
