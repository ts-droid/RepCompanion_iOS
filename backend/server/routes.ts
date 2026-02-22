import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticatedOrDev } from "./devAuth";
import { requireAdminAuth } from "./adminMiddleware";
import { 
  verifyAppleToken, 
  verifyGoogleToken, 
  createInternalToken, 
  upsertUserFromAuth,
  JWT_SECRET
} from "./auth";
import { sendMagicLinkEmail } from "./email-service";
import jwt from "jsonwebtoken";
import * as schema from "@shared/schema";
import { insertUserProfileSchema, updateUserProfileSchema, insertGymSchema, updateGymSchema, insertEquipmentSchema, insertWorkoutSessionSchema, insertExerciseLogSchema, updateExerciseLogSchema, suggestAlternativeRequestSchema, suggestAlternativeResponseSchema, trackPromoImpressionSchema, trackAffiliateClickSchema, insertNotificationPreferencesSchema, promoIdParamSchema, promoPlacementParamSchema, generateProgramRequestSchema, insertAiPromptSchema, aiPrompts, exercises, exerciseLogs, workoutSessions, programTemplateExercises, unmappedExercises, equipmentCatalog, exerciseAliases, equipmentAliases, gyms, users, userProfiles, userTimeModel, adminUsers, type ExerciseLog } from "@shared/schema";
import { z, ZodError } from "zod";
import { generateWorkoutProgram, generateWorkoutProgramWithReasoner, generateWorkoutProgramWithVersionSwitch, generateWorkoutBlueprintV4WithOpenAI } from "./ai-service";
import { recognizeEquipmentFromImage } from "./roboflow-service";
import { JobManager } from "./generation-jobs";
import { promoService } from "./promo-service";
import { workoutGenerationService } from "./workout-generation-service";
import { adjustProgramDuration, analyzeMuscleGroupBalance } from "./program-adjustment-service";
import { vitalService } from "./vital-service";
import { db } from "./db";
import { eq, sql, and, gte, lte, desc } from "drizzle-orm";
import { healthConnections, healthMetrics } from "@shared/schema";

const authRequestSchema = z.object({
  idToken: z.string().min(1, "ID Token is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // ========== PUBLIC ROUTES ==========
  // Read version from package.json for health check
  const fs = await import("fs");
  const path = await import("path");
  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const APP_VERSION = packageJson.version;

  // ========== PUBLIC ROUTES ==========

  app.get("/api/health", async (_req, res) => {
    try {
      // Basic DB check
      const dbResult = await db.execute(sql`SELECT 1 as connected`);
      const isConnected = Array.isArray(dbResult.rows) && dbResult.rows.length > 0;
      
      res.json({
        status: isConnected ? "ok" : "degraded",
        version: APP_VERSION,
        time: new Date().toISOString(),
        database: isConnected ? "connected" : "disconnected",
        env: process.env.NODE_ENV || "development",
        railway: !!process.env.RAILWAY_ENVIRONMENT
      });
    } catch (error: any) {
      res.status(503).json({
        status: "error",
        version: APP_VERSION,
        error: error.message,
        database: "unreachable"
      });
    }
  });

  app.get("/api/version", (_req, res) => {
    res.json({ version: APP_VERSION });
  });

  app.get("/api/ping", (_req, res) => {
    res.send("pong");
  });

  // ========== AUTH ROUTES ==========
  
  app.post("/api/auth/apple", async (req, res) => {
    try {
      const { idToken, firstName, lastName } = authRequestSchema.parse(req.body);
      const authUser = await verifyAppleToken(idToken);
      
      // Use name from request if token doesn't provide it (common for Apple)
      if (firstName) authUser.firstName = firstName;
      if (lastName) authUser.lastName = lastName;
      
      const user = await upsertUserFromAuth(authUser);
      const token = createInternalToken(user.id);
      
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      });
    } catch (error) {
      res.status(401).json({ 
        message: "Apple authentication failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/auth/google", async (req, res) => {
    try {
      const { idToken, firstName, lastName } = authRequestSchema.parse(req.body);
      const authUser = await verifyGoogleToken(idToken);
      
      // Allow overriding/supplementing name from request
      if (firstName) authUser.firstName = firstName;
      if (lastName) authUser.lastName = lastName;
      
      const user = await upsertUserFromAuth(authUser);
      const token = createInternalToken(user.id);
      
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        }
      });
    } catch (error) {
      console.log("[Auth] ❌ Google authentication failed:", error instanceof Error ? error.message : String(error));
      res.status(401).json({ 
        message: "Google authentication failed",
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.post("/api/auth/magic-link", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      
      // Generate a short-lived token for the magic link
      const magicToken = jwt.sign({ email, type: "magic-link" }, JWT_SECRET, { expiresIn: "15m" });
      
      const link = `repcompanion://magic-link?token=${magicToken}`;
      
      // Send email via Resend (or log to console if no API key)
      await sendMagicLinkEmail({
        to: email,
        magicLink: link,
      });
      
      res.json({ message: "Magic link sent" });
    } catch (error) {
      console.error('[MAGIC LINK] Error:', error);
      res.status(400).json({ message: "Failed to send magic link" });
    }
  });

  app.post("/api/auth/magic-link/verify", async (req, res) => {
    try {
      const { token } = z.object({ token: z.string() }).parse(req.body);
      
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.type !== "magic-link") {
        throw new Error("Invalid token type");
      }
      
      const email = decoded.email;
      const user = await upsertUserFromAuth({
        id: `magic_${email}`, // Use email-based ID for magic link users
        email: email,
      });
      
      const internalToken = createInternalToken(user.id);
      
      res.json({
        token: internalToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      });
    } catch (error) {
      res.status(401).json({ message: "Invalid or expired magic link" });
    }
  });

  app.get("/api/auth/user", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Track activity (async, no await to not block)
      storage.updateUserActivity(userId).catch(err => console.error("Failed to update user activity:", err));
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
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

app.post("/api/profile/suggest-onerm", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const { bodyWeight = 75, sex = "man", trainingLevel = "van" } = req.body;
      
      const isMale = sex === "man";
      const isBeginner = trainingLevel === "nybörjare";
      
      const benchMultiplier = isMale ? (isBeginner ? 0.6 : 0.9) : (isBeginner ? 0.4 : 0.6);
      const squatMultiplier = isMale ? (isBeginner ? 0.8 : 1.2) : (isBeginner ? 0.6 : 0.9);
      const deadliftMultiplier = isMale ? (isBeginner ? 1.0 : 1.4) : (isBeginner ? 0.7 : 1.1);
      const ohpMultiplier = isMale ? (isBeginner ? 0.4 : 0.6) : (isBeginner ? 0.3 : 0.45);
      const latpullMultiplier = isMale ? (isBeginner ? 0.5 : 0.7) : (isBeginner ? 0.4 : 0.6);

      res.json({
        oneRmBench: Math.round(bodyWeight * benchMultiplier),
        oneRmOhp: Math.round(bodyWeight * ohpMultiplier),
        oneRmDeadlift: Math.round(bodyWeight * deadliftMultiplier),
        oneRmSquat: Math.round(bodyWeight * squatMultiplier),
        oneRmLatpull: Math.round(bodyWeight * latpullMultiplier)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to suggest 1RM values" });
    }
  });

  app.get("/api/profile/muscle-balance", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const analysis = await analyzeMuscleGroupBalance(userId);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch muscle balance analysis" });
    }
  });

  app.post("/api/profile/suggest-goals", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const { motivationType, trainingLevel, specificSport, age, sex, bodyWeight, height } = req.body;
      
      console.log(`[Suggested Goals] 🎯 Generating goals for motivation: ${motivationType}, sport: ${specificSport || 'none'}`);

      const openai = await import("openai");
      const client = new openai.default({ apiKey: process.env.OPENAI_API_KEY });
      
      const prompt = `
      You are an expert strength and conditioning coach.
      Create a training profile for a user with these details:
      - Motivation: ${motivationType}
      - Sport: ${specificSport || "None"}
      - Level: ${trainingLevel}
      - Age: ${age || "Unknown"}, Sex: ${sex || "Unknown"}
      
      Return a JSON object STRICTLY in this format (no markdown code blocks):
      {
        "goalStrength": number (0-100),
        "goalHypertrophy": number (0-100),
        "goalEndurance": number (0-100),
        "goalCardio": number (0-100),
        "focusTags": ["string", "string"] (max 2 distinct short tags like "Power", "Agility", "Core"),
        "selectedIntent": "string" (one short word e.g. "Explosive", "Endurance", "Strength")
      }
      
      Constraint: The 4 goal values MUST sum to exactly 100.
      Prioritize the specific demands of the sport "${specificSport}".
      `;

      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: "You represent a JSON API. return only valid JSON." }, { role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("No content from AI");
      
      const result = JSON.parse(content);
      
      res.json({
        goalStrength: result.goalStrength || 25,
        goalVolume: result.goalHypertrophy || result.goalVolume || 25, // legacy key mapping
        goalEndurance: result.goalEndurance || 25,
        goalCardio: result.goalCardio || 25,
        goalHypertrophy: result.goalHypertrophy || result.goalVolume || 25, // new key
        focusTags: result.focusTags || [],
        selectedIntent: result.selectedIntent
      });

    } catch (error) {
      console.error("[Suggested Goals] ❌ Failed:", error);
      res.json({
        goalStrength: 25,
        goalVolume: 25,
        goalEndurance: 25,
        goalCardio: 25,
        goalHypertrophy: 25,
        focusTags: [],
        selectedIntent: null
      });
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
        try {
          await adjustProgramDuration(userId, validatedData.sessionDuration!, oldProfile?.selectedGymId || undefined);
        } catch (error) {
          console.error("Local duration adjustment failed, will fallback to AI:", error);
          // If local fails, we just let trainingSettingsChanged stay true and trigger AI
        }
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
          
          const workoutData = await workoutGenerationService.getUserWorkoutData(userId);
          if (workoutData) {
            const systemPrompt = workoutGenerationService.getSystemPrompt();
            const userPrompt = workoutGenerationService.buildUserPrompt(workoutData);
            
            // Get extended profile data for V2 generation
            const extendedProfile = await workoutGenerationService.getExtendedProfileData(userId);
            
            const program = await generateWorkoutProgramWithVersionSwitch(
              systemPrompt, 
              userPrompt, 
              workoutData.session_length_minutes,
              extendedProfile || undefined
            );
            await storage.clearUserProgramTemplates(userId);
            await storage.createProgramTemplatesFromAI(userId, program);
            await storage.incrementProgramGeneration(userId);
            // Reset pass counter to 1 for new program cycle
            await storage.updateUserProfile(userId, { currentPassNumber: 1 });
            
            const generationStatus = await workoutGenerationService.canGenerateProgram(userId);
          }
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

  // Reset profile values (for onboarding reset)
  app.post("/api/profile/reset", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Reset profile to default values, clearing sport-specific data
      await db
        .update(userProfiles)
        .set({
          age: null,
          sex: null,
          bodyWeight: null,
          height: null,
          oneRmBench: null,
          oneRmOhp: null,
          oneRmDeadlift: null,
          oneRmSquat: null,
          oneRmLatpull: null,
          goalStrength: 25,
          goalVolume: 25,
          goalEndurance: 25,
          goalCardio: 25,
          motivationType: null,
          trainingLevel: null,
          specificSport: null, // ← CRITICAL: Clear stale sport data
          sessionsPerWeek: 3,
          sessionDuration: 60,
          onboardingCompleted: false,
          equipmentRegistered: false,
          selectedGymId: null,
          hasAiProgram: false,
          aiProgramData: null,
        })
        .where(eq(userProfiles.userId, userId));

      console.log(`[API] ✅ Reset profile for user ${userId}, cleared specificSport`);
      res.json({ success: true, message: "Profile reset successfully" });
    } catch (error) {
      console.error("[API] ❌ Error resetting profile:", error);
      res.status(500).json({ message: "Failed to reset profile" });
    }
  });

  // Reset user gyms (remove only non-verified gyms) and clear active gym if needed
  app.post("/api/gyms/reset", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const removed = await db
        .delete(gyms)
        .where(and(eq(gyms.userId, userId), eq(gyms.isVerified, false)))
        .returning();
      
      // If selected gym was removed, clear selection
      const profile = await storage.getUserProfile(userId);
      if (profile?.selectedGymId) {
        const stillExists = await storage.getGym(profile.selectedGymId);
        if (!stillExists) {
          await db
            .update(userProfiles)
            .set({ selectedGymId: null, updatedAt: new Date() })
            .where(eq(userProfiles.userId, userId));
        }
      }
      
      res.json({ success: true, removed: removed.length });
    } catch (error) {
      console.error("[API] ❌ Error resetting gyms:", error);
      res.status(500).json({ message: "Failed to reset gyms" });
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

  app.post("/api/onboarding/complete", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { profile, equipment, selectedGymId } = req.body;

      // DEBUG: Log received data
      console.log("[Onboarding] 📥 Received request from user:", userId);
      console.log("[Onboarding] 📋 Profile data:", JSON.stringify(profile, null, 2));
      console.log("[Onboarding] 🏋️ Equipment:", equipment);
      console.log("[Onboarding] 🏢 Selected Gym ID:", selectedGymId);

      if (!profile?.motivationType || !profile?.trainingLevel || !profile?.sessionsPerWeek || !profile?.sessionDuration) {
        console.log("[Onboarding] ❌ Validation failed - missing required fields:");
        console.log("  - motivationType:", profile?.motivationType);
        console.log("  - trainingLevel:", profile?.trainingLevel);
        console.log("  - sessionsPerWeek:", profile?.sessionsPerWeek);
        console.log("  - sessionDuration:", profile?.sessionDuration);
        return res.status(400).json({ 
          message: "Missing required profile fields",
          missing: {
            motivationType: !profile?.motivationType,
            trainingLevel: !profile?.trainingLevel,
            sessionsPerWeek: !profile?.sessionsPerWeek,
            sessionDuration: !profile?.sessionDuration
          }
        });
      }

      const goalStrength = Math.max(0, Math.min(100, profile.goalStrength ?? 50));
      const goalVolume = Math.max(0, Math.min(100, profile.goalVolume ?? 50));
      const goalEndurance = Math.max(0, Math.min(100, profile.goalEndurance ?? 50));
      const goalCardio = Math.max(0, Math.min(100, profile.goalCardio ?? 50));
      const sessionsPerWeek = Math.max(1, Math.min(7, profile.sessionsPerWeek));
      const sessionDuration = Math.max(15, Math.min(180, profile.sessionDuration));

      const equipmentRegistered = equipment && Array.isArray(equipment) && equipment.length > 0;

      let preliminaryProfile;
      try {
        preliminaryProfile = insertUserProfileSchema.parse({
          ...profile,
          userId,
          goalStrength,
          goalVolume,
          goalEndurance,
          goalCardio,
          sessionsPerWeek,
          sessionDuration,
          onboardingCompleted: false,
          equipmentRegistered: false,
        });
      } catch (error) {
        console.log("[Onboarding] ❌ Schema validation failed!");
        console.log("[Onboarding] 📋 Error details:", JSON.stringify(error, null, 2));
        if (error instanceof Error) {
          console.log("[Onboarding] 📋 Error message:", error.message);
        }
        return res.status(400).json({ 
          message: "Validation error",
          error: error instanceof Error ? error.message : String(error)
        });
      }

      await storage.upsertUserProfile(preliminaryProfile);

      let gymIdToUse = selectedGymId || null;
      let firstGym: any = null;

      if (!gymIdToUse && equipmentRegistered) {
        // Check if "Mitt Gym" already exists to avoid duplicates
        const existingMittGym = await db.select().from(gyms)
          .where(and(
            eq(gyms.userId, userId),
            eq(gyms.name, "Mitt Gym")
          ))
          .limit(1);

        if (existingMittGym.length > 0) {
           firstGym = existingMittGym[0];
        } else {
          firstGym = await storage.createGym({
            userId,
            name: "Mitt Gym",
          });
        }
        gymIdToUse = firstGym.id;

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
      } else if (gymIdToUse) {
        // Fetch existing gym details if needed for logging/response
        firstGym = await storage.getGym(gymIdToUse);
      }

      const finalProfile = await storage.upsertUserProfile({
        ...preliminaryProfile,
        onboardingCompleted: true,
        equipmentRegistered: equipmentRegistered || !!selectedGymId,
        selectedGymId: gymIdToUse,
      });

      // Check if there's already an active generation job for this user
      const activeJob = JobManager.getUserActiveJob(userId);
      if (activeJob) {
        console.log("[Onboarding] ⏳ Job already in progress for user:", userId, "Job ID:", activeJob.id);
        return res.json({ 
          success: true, 
          profile: finalProfile, 
          gym: firstGym,
          program: {
            jobId: activeJob.id,
            status: activeJob.status
          }
        });
      }

      // Create a background job for program generation
      const job = JobManager.createJob(userId);

      // Trigger generation in background
      (async () => {
        try {
          const workoutData = await workoutGenerationService.getUserWorkoutData(userId);
          if (workoutData) {
            const systemPrompt = workoutGenerationService.getSystemPrompt();
            const userPrompt = workoutGenerationService.buildUserPrompt(workoutData);
            
            // Get extended profile data for V2 generation
            const extendedProfile = await workoutGenerationService.getExtendedProfileData(userId);
            
            const program = await generateWorkoutProgramWithVersionSwitch(
              systemPrompt, 
              userPrompt, 
              workoutData.session_length_minutes,
              extendedProfile || undefined,
              job.id
            );
            console.log("[Onboarding] ✅ Program generated successfully");
            
            console.log("[Onboarding] 🗑️ Clearing old templates...");
            await storage.clearUserProgramTemplates(userId);
            console.log("[Onboarding] ✅ Old templates cleared");
            
            console.log("[Onboarding] 💾 Creating new templates from AI...");
            await storage.createProgramTemplatesFromAI(userId, program);
            console.log("[Onboarding] ✅ Templates created successfully");
            
            console.log("[Onboarding] 📝 Updating user profile (currentPassNumber = 1)...");
            await storage.updateUserProfile(userId, { currentPassNumber: 1 });
            console.log("[Onboarding] ✅ Profile updated successfully");
            
            console.log("[Onboarding] 🎉 Marking job as completed...");
            JobManager.updateJob(job.id, { status: 'completed', progress: 100 });
            console.log("[Onboarding] ✅ Job marked as completed! Job ID:", job.id);
          }
        } catch (programError) {
          console.error("[Onboarding] ❌ Background generation failed:", programError);
          if (programError instanceof Error) {
            console.error("[Onboarding] Error stack:", programError.stack);
          }
          JobManager.updateJob(job.id, { 
            status: 'failed', 
            error: programError instanceof Error ? programError.message : String(programError) 
          });
        }
      })();

      res.json({ 
        success: true, 
        profile: finalProfile, 
        gym: firstGym,
        program: {
          jobId: job.id,
          status: job.status
        }
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("[Onboarding] ❌ Error completing onboarding:", error);
      if (error instanceof Error) {
        console.error("[Onboarding] Error message:", error.message);
        console.error("[Onboarding] Error stack:", error.stack);
      }
      res.status(500).json({ 
        message: "Failed to complete onboarding",
        error: error instanceof Error ? error.message : String(error)
      });
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

  app.get("/api/gyms/nearby", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const { lat, lng, radius } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ message: "Latitude (lat) and longitude (lng) are required" });
      }

      const latitude = parseFloat(String(lat));
      const longitude = parseFloat(String(lng));
      const radiusKm = radius ? parseFloat(String(radius)) : 50;

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }

      const nearbyGyms = await storage.findNearbyGyms(latitude, longitude, radiusKm);
      res.json(nearbyGyms);
    } catch (error) {
      console.error("[GYM] Failed to search nearby gyms:", error);
      res.status(500).json({ message: "Failed to search nearby gyms" });
    }
  });

  app.get("/api/gyms/:id([0-9a-fA-F-]{36})/equipment", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const gymId = req.params.id;
      const gym = await storage.getGym(gymId);

      if (!gym) {
        return res.status(404).json({ message: "Gym not found" });
      }

      const canAccess = gym.userId === userId || gym.isPublic || gym.isVerified;
      if (!canAccess) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const equipment = await storage.getGymEquipment(gymId);
      res.json(equipment);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gym equipment" });
    }
  });

  app.get("/api/gym-programs", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const programs = await storage.getUserGymPrograms(userId);
      res.json(programs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch gym programs" });
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

  app.patch("/api/gyms/:id([0-9a-fA-F-]{36})", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.patch("/api/gyms/:id([0-9a-fA-F-]{36})/select", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.delete("/api/gyms/:id([0-9a-fA-F-]{36})", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.delete("/api/equipment/:id([0-9a-fA-F-]{36})", isAuthenticatedOrDev, async (req: any, res) => {
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

  // Equipment Catalog (public endpoint for onboarding)
  app.get("/api/equipment/catalog", async (_req, res) => {
    try {
      const catalog = await storage.getEquipmentCatalog();
      res.json(catalog);
    } catch (error) {
      console.error('[EQUIPMENT CATALOG] Error:', error);
      res.status(500).json({ message: "Failed to fetch equipment catalog" });
    }
  });

  // ========== GYM PROGRAM ROUTES ==========
  
  app.get("/api/gym-programs/:gymId([0-9a-fA-F-]{36})", isAuthenticatedOrDev, async (req: any, res) => {
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
  app.get("/api/programs/status", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templates = await storage.getTemplatesWithMetadata(userId);
      const hasTemplates = templates.length > 0;
      res.json({
        status: hasTemplates ? "ready" : "no_program",
        message: hasTemplates ? "Program ready" : "No program available",
        hasTemplates: hasTemplates,
        templatesCount: templates.length,
        progress: hasTemplates ? 100 : 0
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get program status" });
    }
  });

  app.get("/api/program/generate/status/:jobId", isAuthenticatedOrDev, async (req: any, res) => {
    const { jobId } = req.params;
    const job = JobManager.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    
    res.json({
      status: job.status,
      progress: job.progress,
      error: job.error
    });
  });

  app.get("/api/program/status", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templates = await storage.getTemplatesWithMetadata(userId);
      
      const hasTemplates = templates.length > 0;
      
      res.json({
        status: hasTemplates ? "ready" : "no_program",
        message: hasTemplates ? "Program ready" : "No program available",
        hasTemplates: hasTemplates,
        templatesCount: templates.length,
        progress: hasTemplates ? 100 : 0
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get program status" });
    }
  });

  app.get("/api/program/:id([0-9a-fA-F-]{36})", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const templateId = req.params.id;
      
      const template = await storage.getProgramTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found (via /api/program/:id GET)" });
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
  app.post("/api/program/templates/:templateId([0-9a-fA-F-]{36})/exercises", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.patch("/api/program/templates/:id([0-9a-fA-F-]{36})", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.patch("/api/program/:id([0-9a-fA-F-]{36})/meta", isAuthenticatedOrDev, async (req: any, res) => {
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
      
      
      await storage.createProgramTemplatesFromAI(userId, profile.aiProgramData as any);
      
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
      
      const program = await generateWorkoutProgram(profile, equipment);
      
      const profileUpdate = insertUserProfileSchema.parse({
        userId: profile.userId,
        age: profile.age,
        sex: profile.sex,
        bodyWeight: profile.bodyWeight,
        height: profile.height,
        bodyFatPercent: profile.bodyFatPercent,
        muscleMassPercent: profile.muscleMassPercent,
        oneRmBench: profile.oneRmBench,
        oneRmOhp: profile.oneRmOhp,
        oneRmDeadlift: profile.oneRmDeadlift,
        oneRmSquat: profile.oneRmSquat,
        oneRmLatpull: profile.oneRmLatpull,
        trainingGoals: profile.trainingGoals,
        goalStrength: profile.goalStrength,
        goalVolume: profile.goalVolume,
        goalEndurance: profile.goalEndurance,
        goalCardio: profile.goalCardio,
        sessionsPerWeek: profile.sessionsPerWeek,
        sessionDuration: profile.sessionDuration,
        restTime: profile.restTime,
        onboardingCompleted: profile.onboardingCompleted,
        appleHealthConnected: profile.appleHealthConnected,
        equipmentRegistered: profile.equipmentRegistered,
        hasAiProgram: true,
        aiProgramData: program,
        lastSessionType: profile.lastSessionType,
      });
      
      const updatedProfile = await storage.upsertUserProfile(profileUpdate);

      res.json({ success: true, program, profile: updatedProfile });
    } catch (error) {
      res.status(500).json({ 
        message: "Failed to generate workout program",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // New DeepSeek Reasoner workout generation
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
      
      // Get user workout data
      const workoutData = await workoutGenerationService.getUserWorkoutData(userId);
      if (!workoutData) {
        return res.status(400).json({ message: "Användarprofil saknas eller ofullständig" });
      }
      
      // Build prompts
      const systemPrompt = workoutGenerationService.getSystemPrompt();
      const userPrompt = workoutGenerationService.buildUserPrompt(workoutData);
      
      
      // Get extended profile data for V2 generation
      const extendedProfile = await workoutGenerationService.getExtendedProfileData(userId);
      
      // Call AI API with duration validation using version switcher
      const program = await generateWorkoutProgramWithVersionSwitch(
        systemPrompt, 
        userPrompt, 
        workoutData.session_length_minutes,
        extendedProfile || undefined
      );
      
      
      // Clear existing templates
      await storage.clearUserProgramTemplates(userId);
      
      // Save new templates to database
      await storage.createProgramTemplatesFromAI(userId, program);
      
      // Reset pass counter to 1 for new program cycle
      await storage.updateUserProfile(userId, { currentPassNumber: 1 });
      
      // Also save program to gym_programs for selected gym
      const profile = await storage.getUserProfile(userId);
      if (profile?.selectedGymId) {
        await storage.upsertGymProgram({
          userId,
          gymId: profile.selectedGymId,
          programData: program,
        });
      }
      
      // Get created templates for response
      const templates = await storage.getUserProgramTemplates(userId);
      
      
      res.json({ 
        success: true, 
        message: "Träningsprogram genererat",
        templatesCreated: templates.length,
        programOverview: program.program_overview,
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

  app.get("/api/sessions/:id([0-9a-fA-F-]{36})", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.get("/api/sessions/:id([0-9a-fA-F-]{36})/details", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.patch("/api/sessions/:id([0-9a-fA-F-]{36})/snapshot", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.post("/api/sessions/:id([0-9a-fA-F-]{36})/complete", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.patch("/api/sessions/:id([0-9a-fA-F-]{36})/cancel", isAuthenticatedOrDev, async (req: any, res) => {
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
  
  app.get("/api/sessions/:sessionId([0-9a-fA-F-]{36})/exercises", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.patch("/api/exercises/:id([0-9a-fA-F-]{36})", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.post("/api/sessions/:sessionId([0-9a-fA-F-]{36})/exercises/:exerciseOrderIndex/bulk-update", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.post("/api/promos/:id([0-9a-fA-F-]{36})/impression", isAuthenticatedOrDev, async (req: any, res) => {
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

  app.post("/api/affiliate/click/:id([0-9a-fA-F-]{36})", isAuthenticatedOrDev, async (req: any, res) => {
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
  app.get("/api/exercises/for-template/:templateId([0-9a-fA-F-]{36})", isAuthenticatedOrDev, async (req: any, res) => {
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

  // ========== V4 BLUEPRINT & TIME MODEL ROUTES ==========

  app.post("/api/program/generate-v4", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profile = await storage.getUserProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      const targetDuration = profile.sessionDuration || 60;
      const blueprint = await generateWorkoutBlueprintV4WithOpenAI(profile, targetDuration);
      
      res.json({ program: blueprint });
    } catch (error) {
      console.error("[V4] Generation failed:", error);
      res.status(500).json({ 
        message: "V4 Blueprint generation failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/user/time-model", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const timeModel = await storage.getUserTimeModel(userId);
      res.json(timeModel || {
        workSecondsPer10Reps: 30,
        restBetweenSetsSeconds: 90,
        restBetweenExercisesSeconds: 120,
        warmupMinutesDefault: 8,
        cooldownMinutesDefault: 5,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch time model" });
    }
  });

  app.put("/api/user/time-model", isAuthenticatedOrDev, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const timeModelSchema = z.object({
        workSecondsPer10Reps: z.number(),
        restBetweenSetsSeconds: z.number(),
        restBetweenExercisesSeconds: z.number(),
        warmupMinutesDefault: z.number(),
        cooldownMinutesDefault: z.number(),
      });
      
      const validatedData = timeModelSchema.parse(req.body);
      
      // We need to implement upsertUserTimeModel in storage.ts
      // For now, let's assume it exists or use a raw db call if needed
      // Actually, let's add it to storage.ts properly.
      
      // For this step, I'll use a placeholder and then fix storage.ts
      const [updated] = await db
        .insert(userTimeModel)
        .values({
          userId,
          ...validatedData,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userTimeModel.userId],
          set: {
            ...validatedData,
            updatedAt: new Date(),
          },
        })
        .returning();
        
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update time model" });
    }
  });

  // ========== ADMIN ROUTES ==========

  app.get("/api/admin/prompts", requireAdminAuth, async (_req, res) => {
    try {
      const prompts = await storage.getAllAiPrompts();
      res.json(prompts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch prompts" });
    }
  });

  app.post("/api/admin/prompts", requireAdminAuth, async (req, res) => {
    try {
      const promptData = insertAiPromptSchema.parse(req.body);
      const prompt = await storage.upsertAiPrompt(promptData);
      res.json(prompt);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save prompt" });
    }
  });

  app.delete("/api/admin/prompts/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteAiPrompt(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete prompt" });
    }
  });

  app.get("/api/admin/unmapped-exercises", requireAdminAuth, async (req: any, res) => {
    try {
      const data = await storage.adminGetUnmappedExercises();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unmapped exercises" });
    }
  });

  app.get("/api/admin/exercises", requireAdminAuth, async (req: any, res) => {
    try {
      const data = await db.select().from(exercises).orderBy(exercises.nameEn);
      
      const enhancedData = await Promise.all(data.map(async (ex) => {
        const aliases = await db.select().from(exerciseAliases).where(eq(exerciseAliases.exerciseId, ex.exerciseId || ""));
        return { ...ex, aliases: aliases.map(a => a.alias) };
      }));
      
      res.json(enhancedData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch exercises" });
    }
  });

  app.post("/api/admin/exercises", requireAdminAuth, async (req: any, res) => {
    try {
      const exercise = await storage.adminCreateExercise(req.body);
      res.json(exercise);
    } catch (error: any) {
      console.error("[ADMIN API] Failed to create exercise:", error);
      res.status(500).json({ message: error.message || "Failed to create exercise" });
    }
  });

  app.put("/api/admin/exercises/:id([0-9a-fA-F-]{36})", requireAdminAuth, async (req: any, res) => {
    try {
      const updated = await storage.adminUpdateExercise(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update exercise" });
    }
  });

  app.post("/api/admin/exercises/merge", requireAdminAuth, async (req: any, res) => {
    try {
      const { sourceId, targetId } = req.body;
      if (!sourceId || !targetId) {
        return res.status(400).json({ message: "sourceId and targetId are required" });
      }
      await storage.adminMergeExercises(sourceId, targetId);
      res.json({ message: "Exercises merged successfully" });
    } catch (error: any) {
      console.error("[ADMIN API] Failed to merge exercises:", error);
      res.status(500).json({ message: error.message || "Failed to merge exercises" });
    }
  });

  app.post("/api/admin/exercise-aliases", requireAdminAuth, async (req: any, res) => {
    try {
      const alias = await storage.adminCreateExerciseAlias(req.body);
      res.json(alias);
    } catch (error: any) {
      console.error("[ADMIN API] Failed to create exercise alias:", error);
      res.status(500).json({ message: error.message || "Failed to create exercise alias" });
    }
  });

  app.get("/api/admin/equipment", requireAdminAuth, async (req: any, res) => {
    try {
      const data = await db.select().from(equipmentCatalog).orderBy(equipmentCatalog.nameEn);
      
      const enhancedData = await Promise.all(data.map(async (item) => {
        const aliasesList = await db.select().from(equipmentAliases).where(eq(equipmentAliases.equipmentKey, item.equipmentKey || ""));
        return { ...item, aliases: aliasesList };
      }));
      
      res.json(enhancedData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  app.post("/api/admin/equipment", requireAdminAuth, async (req: any, res) => {
    try {
      const equipment = await storage.adminCreateEquipment(req.body);
      res.json(equipment);
    } catch (error: any) {
      console.error("[ADMIN API] Failed to create equipment:", error);
      res.status(500).json({ message: error.message || "Failed to create equipment" });
    }
  });

  app.put("/api/admin/equipment/:id([0-9a-fA-F-]{36})", requireAdminAuth, async (req: any, res) => {
    try {
      const { name, nameEn, equipmentKey, category, type, description } = req.body;
      // Sanitize payload to remove id, createdAt, aliases, etc.
      const cleanData: any = { 
        name, 
        nameEn, 
        equipmentKey, 
        category, 
        type: type || 'gym_equipment', // Fallback if missing
        description 
      };
      
      // Remove undefined keys
      Object.keys(cleanData).forEach(key => cleanData[key] === undefined && delete cleanData[key]);

      const updated = await storage.adminUpdateEquipment(req.params.id, cleanData);
      res.json(updated);
    } catch (error: any) {
      console.error("[ADMIN API] Failed to update equipment:", error);
      res.status(500).json({ message: error.message || "Failed to update equipment" });
    }
  });

  app.post("/api/admin/equipment-aliases", requireAdminAuth, async (req: any, res) => {
    try {
      const alias = await storage.adminCreateEquipmentAlias(req.body);
      res.json(alias);
    } catch (error: any) {
      console.error("[ADMIN API] Failed to create equipment alias:", error);
      res.status(500).json({ message: error.message || "Failed to create equipment alias" });
    }
  });

  app.delete("/api/admin/equipment-aliases/:id", requireAdminAuth, async (req: any, res) => {
    try {
      await storage.adminDeleteEquipmentAlias(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete equipment alias" });
    }
  });

  app.get("/api/admin/gyms", requireAdminAuth, async (req: any, res) => {
    try {
      
      const data = await db
        .select({
          id: gyms.id,
          name: gyms.name,
          location: gyms.location,
          latitude: gyms.latitude,
          longitude: gyms.longitude,
          isPublic: gyms.isPublic,
          isVerified: gyms.isVerified,
          userId: gyms.userId,
          userEmail: users.email,
          createdAt: gyms.createdAt,
        })
        .from(gyms)
        .leftJoin(users, eq(gyms.userId, users.id))
        .orderBy(desc(gyms.createdAt));

      // Fetch equipment for each gym
      const enhancedData = await Promise.all(
        data.map(async (gym) => {
          const equipment = await storage.adminGetGymEquipment(gym.id);
          
          return {
            ...gym,
            equipmentCount: equipment.length,
            equipment: equipment,
          };
        })
      );

      res.json(enhancedData);
    } catch (error) {
      console.error("[ADMIN API] Failed to fetch gyms:", error);
      res.status(500).json({ message: "Failed to fetch gyms" });
    }
  });

  app.put("/api/admin/gyms/:id", requireAdminAuth, async (req: any, res) => {
    try {
      const { equipmentKeys, ...gymData } = req.body;
      const updated = await storage.adminUpdateGym(req.params.id, gymData, equipmentKeys);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update gym" });
    }
  });

  app.delete("/api/admin/exercises/:id", requireAdminAuth, async (req: any, res) => {
    try {
      await storage.adminDeleteExercise(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete exercise" });
    }
  });

  app.delete("/api/admin/unmapped-exercises/:id", requireAdminAuth, async (req: any, res) => {
    try {
      await storage.adminDeleteUnmappedExercise(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete unmapped exercise" });
    }
  });

  app.delete("/api/admin/equipment/:id", requireAdminAuth, async (req: any, res) => {
    try {
      await storage.adminDeleteEquipmentCatalog(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete equipment" });
    }
  });

  app.delete("/api/admin/gyms/:id", requireAdminAuth, async (req: any, res) => {
    try {
      await storage.adminDeleteGym(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete gym" });
    }
  });

  app.post("/api/admin/exercises/delete-batch", requireAdminAuth, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ message: "IDs must be an array" });
      await storage.adminDeleteExercisesBatch(ids);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete exercises" });
    }
  });

  app.post("/api/admin/unmapped-exercises/delete-batch", requireAdminAuth, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ message: "IDs must be an array" });
      await storage.adminDeleteUnmappedExercisesBatch(ids);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete unmapped exercises" });
    }
  });

  app.post("/api/admin/equipment/delete-batch", requireAdminAuth, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ message: "IDs must be an array" });
      await storage.adminDeleteEquipmentCatalogBatch(ids);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete equipment" });
    }
  });

  app.post("/api/admin/gyms/delete-batch", requireAdminAuth, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ message: "IDs must be an array" });
      await storage.adminDeleteGymsBatch(ids);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete gyms" });
    }
  });

  // Admin User Management
  app.get("/api/admin/users", requireAdminAuth, async (_req, res) => {
    try {
      const users = await storage.adminGetAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:id", requireAdminAuth, async (req: any, res) => {
    try {
      const updated = await storage.adminUpdateUser(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdminAuth, async (req: any, res) => {
    try {
      await storage.adminDeleteUser(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post("/api/admin/users/delete-batch", requireAdminAuth, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ message: "IDs must be an array" });
      await storage.adminDeleteUsersBatch(ids);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete users" });
    }
  });

  // ========== DEDICATED ADMIN USER AUTHENTICATION ==========
  
  const { hashPassword, verifyPassword, validatePasswordStrength, generateTOTPSecret, verifyTOTP, generateAdminJWT, verifyAdminJWT } = await import("./adminUserAuth");
  
  /**
   * Step 1: Admin login with email/password
   * Returns: tempToken for multi-step auth flow
   */
  app.post("/api/admin-user/login",async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      // Find admin user
      const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email.toLowerCase()));
      
      if (!admin) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Verify password
      const validPassword = await verifyPassword(password, admin.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Check if password change required
      if (admin.forcePasswordChange) {
        const tempToken = generateAdminJWT(admin.id, email);
        return res.json({
          step: "password_change_required",
          tempToken,
          message: "Password change required before first login"
        });
      }
      
      //Check if 2FA is set up (mandatory)
      if (!admin.totpEnabled) {
        const tempToken = generateAdminJWT(admin.id, email);
        return res.json({
          step: "2fa_setup_required",
          tempToken,
          message: "2FA setup required"
        });
      }
      
      // 2FA enabled - require TOTP token
      const tempToken = generateAdminJWT(admin.id, email);
      return res.json({
        step: "2fa_verification_required",
        tempToken,
        message: "Enter your 6-digit 2FA code"
      });
      
    } catch (error) {
      console.error("[ADMIN-USER-AUTH] Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });
  
  /**
   * Step 2: Change password (required on first login)
   */
  app.post("/api/admin-user/change-password", async (req, res) => {
    try {
      const { tempToken, newPassword } = req.body;
      
      if (!tempToken || !newPassword) {
        return res.status(400).json({ error: "Token and new password required" });
      }
      
      // Verify temp token
      const decoded = verifyAdminJWT(tempToken);
      if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      // Validate password strength
      const validation = validatePasswordStrength(newPassword);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      
      // Hash new password
      const passwordHash = await hashPassword(newPassword);
      
      // Update admin user
      await db
        .update(adminUsers)
        .set({
          passwordHash,
          forcePasswordChange: false,
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.id, decoded.adminId));
      
      // Generate new temp token for next step (2FA setup)
      const newTempToken = generateAdminJWT(decoded.adminId, decoded.email);
      
      res.json({
        success: true,
        step: "2fa_setup_required",
        tempToken: newTempToken,
        message: "Password changed successfully. Now setup 2FA."
      });
    } catch (error) {
      console.error("[ADMIN-USER-AUTH] Password change error:", error);
      res.status(500).json({ error: "Password change failed" });
    }
  });
  
  /**
   * Step 3: Get 2FA setup (QR code)
   */
  app.get("/api/admin-user/2fa/setup", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Auth token required" });
      }
      
      const token = authHeader.substring(7);
      const decoded = verifyAdminJWT(token);
      if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      // Generate TOTP secret and QR code
      const { secret, qrCodeUrl } = await generateTOTPSecret(decoded.email);
      
      // Store secret temporarily (will be confirmed on verification)
      await db
        .update(adminUsers)
        .set({
          totpSecret: secret,
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.id, decoded.adminId));
      
      res.json({
        qrCodeUrl,
        secret,
        message: "Scan QR code with Google Authenticator and enter the 6-digit code"
      });
    } catch (error) {
      console.error("[ADMIN-USER-AUTH] 2FA setup error:", error);
      res.status(500).json({ error: "2FA setup failed" });
    }
  });
  
  /**
   * Step 4: Enable 2FA (verify first TOTP token)
   */
  app.post("/api/admin-user/2fa/enable", async (req, res) => {
    try {
      const { tempToken, totpToken } = req.body;
      
      if (!tempToken || !totpToken) {
        return res.status(400).json({ error: "Token and TOTP code required" });
      }
      
      const decoded = verifyAdminJWT(tempToken);
      if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      // Get admin user
      const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, decoded.adminId));
      if (!admin || !admin.totpSecret) {
        return res.status(400).json({ error: "2FA not set up" });
      }
      
      // Verify TOTP token
      const valid = verifyTOTP(totpToken, admin.totpSecret);
      if (!valid) {
        return res.status(401).json({ error: "Invalid 2FA code" });
      }
      
      // Enable 2FA
      await db
        .update(adminUsers)
        .set({
          totpEnabled: true,
          lastLogin: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.id, decoded.adminId));
      
      // Generate final JWT token
      const authToken = generateAdminJWT(decoded.adminId, decoded.email);
      
      res.json({
        success: true,
        authToken,
        email: decoded.email,
        message: "2FA enabled successfully. You are now logged in."
      });
    } catch (error) {
      console.error("[ADMIN-USER-AUTH] 2FA enable error:", error);
      res.status(500).json({ error: "2FA enable failed" });
    }
  });
  
  /**
   * Step 5: Verify 2FA during login (for returning users)
   */
  app.post("/api/admin-user/2fa/verify", async (req, res) => {
    try {
      const { tempToken, totpToken } = req.body;
      
      if (!tempToken || !totpToken) {
        return res.status(400).json({ error: "Token and TOTP code required" });
      }
      
      const decoded = verifyAdminJWT(tempToken);
      if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      // Get admin user
      const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, decoded.adminId));
      if (!admin || !admin.totpSecret || !admin.totpEnabled) {
        return res.status(400).json({ error: "2FA not properly configured" });
      }
      
      // Verify TOTP token
      const valid = verifyTOTP(totpToken, admin.totpSecret);
      if (!valid) {
        return res.status(401).json({ error: "Invalid 2FA code" });
      }
      
      // Update last login
      await db
        .update(adminUsers)
        .set({
          lastLogin: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.id, decoded.adminId));
      
      // Generate final JWT token
      const authToken = generateAdminJWT(decoded.adminId, decoded.email);
      
      res.json({
        success: true,
        authToken,
        email: decoded.email,
        isSuperAdmin: admin.isSuperAdmin,
        message: "Login successful"
      });
    } catch (error) {
      console.error("[ADMIN-USER-AUTH] 2FA verify error:", error);
      res.status(500).json({ error: "2FA verification failed" });
    }
  });
  
  /**
   * Create new admin user (super admin only)
   */
  app.post("/api/admin-user/create", async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Auth token required" });
      }
      
      const token = authHeader.substring(7);
      const decoded = verifyAdminJWT(token);
      if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      // Verify super admin status
      const [requestingAdmin] = await db.select().from(adminUsers).where(eq(adminUsers.id, decoded.adminId));
      if (!requestingAdmin?.isSuperAdmin) {
        return res.status(403).json({ error: "Only super admins can create new admin users" });
      }
      
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      
      // Validate password
      const validation = validatePasswordStrength(password);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      
      // Hash password
      const passwordHash = await hashPassword(password);
      
      // Create admin user
      const [newAdmin] = await db
        .insert(adminUsers)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          forcePasswordChange: true,
          isSuperAdmin: false,
        })
        .returning();
      
      res.json({
        success: true,
        admin: {
          id: newAdmin.id,
          email: newAdmin.email,
          created: newAdmin.createdAt,
        },
        message: "Admin user created successfully"
      });
    } catch (error: any) {
      console.error("[ADMIN-USER-AUTH] Create admin error:", error);
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: "Admin user with this email already exists" });
      }
      res.status(500).json({ error: "Failed to create admin user" });
    }
  });

  // ========== ADMIN AUTHENTICATION ROUTES ==========
  
  /**
   * Deprecated admin login endpoint - replaced by /api/admin-user/*
   */
  app.post("/api/admin/auth/login", (_req, res) => {
    return res.status(410).json({
      error: "Deprecated",
      message: "Use /api/admin-user/* endpoints for admin authentication.",
    });
  });
  
  /**
   * Set user as admin (protected endpoint)
   */
  app.post("/api/admin/users/:userId/set-admin", requireAdminAuth, async (req: any, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const { isAdmin } = req.body;

      const adminId = req.adminUser?.adminId;
      if (!adminId) {
        return res.status(401).json({ error: "Admin authentication required" });
      }

      const [requestingAdmin] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, adminId));

      if (!requestingAdmin?.isSuperAdmin) {
        return res.status(403).json({ error: "Only super admins can modify admin status" });
      }

      await storage.setUserAdminStatus(targetUserId, isAdmin !== false);
      res.json({ success: true, message: `User admin status updated to ${isAdmin !== false}` });
    } catch (error) {
      console.error("[ADMIN] Set admin error:", error);
      res.status(500).json({ error: "Failed to update admin status" });
    }
  });

  // ========== ADMIN DATA ROUTES ==========

  app.get("/api/admin/stats", requireAdminAuth, async (req: any, res) => {
    try {
      const usersCount = await storage.adminGetUsersCount();
      res.json({ usersCount });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/debug-db", requireAdminAuth, async (_req: any, res) => {
    try {
      console.log(`[DEBUG-DB] Running diagnostics by admin: ${_req.adminUser?.email}`);
      
      const counts = {
        users: await db.select({ count: sql<number>`count(*)` }).from(users).catch(e => ({ error: e.message })),
        exercises: await db.select({ count: sql<number>`count(*)` }).from(exercises).catch(e => ({ error: e.message })),
        unmapped: await db.select({ count: sql<number>`count(*)` }).from(unmappedExercises).catch(e => ({ error: e.message })),
        equipment: await db.select({ count: sql<number>`count(*)` }).from(equipmentCatalog).catch(e => ({ error: e.message })),
        gyms: await db.select({ count: sql<number>`count(*)` }).from(gyms).catch(e => ({ error: e.message })),
        adminUsers: await db.select({ count: sql<number>`count(*)` }).from(adminUsers).catch(e => ({ error: e.message })),
      };
      
      const dbUrl = process.env.DATABASE_URL || "MISSING";
      const anonymizedUrl = dbUrl.replace(/:[^:@]+@/, ":****@");

      res.json({
        status: "ok",
        version: APP_VERSION,
        counts,
        database: anonymizedUrl,
        schemaKeys: Object.keys(schema),
        timestamp: new Date().toISOString(),
        env: {
          NODE_ENV: process.env.NODE_ENV,
          RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
          PORT: process.env.PORT,
          APP_VERSION
        }
      });
    } catch (error: any) {
      console.error("[DEBUG-DB] Fatal Error:", error);
      res.status(500).json({ error: error.message, stack: error.stack, version: APP_VERSION });
    }
  });

  // ========== GYM CAMPAIGNS ==========
  // Public endpoint — shown before login (no auth required)
  app.get("/api/gym-campaigns/active", async (_req, res) => {
    try {
      const campaigns = await storage.getActiveGymCampaigns();
      res.json(campaigns);
    } catch (error: any) {
      console.error("[GymCampaigns] Error fetching active campaigns:", error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Admin endpoints — require admin auth
  app.post("/api/gym-campaigns", requireAdminAuth, async (req, res) => {
    try {
      const campaign = await storage.createGymCampaign(req.body);
      res.status(201).json(campaign);
    } catch (error: any) {
      console.error("[GymCampaigns] Error creating campaign:", error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.patch("/api/gym-campaigns/:id", requireAdminAuth, async (req, res) => {
    try {
      const campaign = await storage.updateGymCampaign(req.params.id, req.body);
      res.json(campaign);
    } catch (error: any) {
      console.error("[GymCampaigns] Error updating campaign:", error);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  app.delete("/api/gym-campaigns/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteGymCampaign(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("[GymCampaigns] Error deleting campaign:", error);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
