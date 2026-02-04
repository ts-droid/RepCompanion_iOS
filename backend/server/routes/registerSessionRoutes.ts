import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticatedOrDev } from "../devAuth";
import { insertWorkoutSessionSchema, type ExerciseLog } from "@shared/schema";
import { ZodError } from "zod";
import { vitalService } from "../vital-service";

export function registerSessionRoutes(app: Express) {
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

      if (session.templateId) {
        try {
          const template = await storage.getProgramTemplate(session.templateId);
          
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
        } catch (error) {
        }
      }
      
      const movergyScore = req.body.movergyScore;
      await storage.completeWorkoutSession(req.params.id, movergyScore);
      
      if (session.templateId) {
        await storage.incrementPassNumber(userId);
      }
      
      try {
        const sessionLogs = await storage.getSessionExerciseLogs(req.params.id);
        const sessionStart = new Date(session.startedAt);
        const sessionEnd = new Date();
        const durationMinutes = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000 / 60);
        
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
}
