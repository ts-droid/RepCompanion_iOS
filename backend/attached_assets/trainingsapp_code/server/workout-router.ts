import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import * as workoutDb from "./workout-db";

export const workoutRouter = router({
  // ========== Profile ==========
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return await workoutDb.getUserProfile(ctx.user.id);
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        age: z.number().optional(),
        sex: z.enum(["male", "female", "other"]).optional(),
        bodyWeight: z.number().optional(),
        height: z.number().optional(),
        bodyFatPercent: z.number().optional(),
        muscleMassPercent: z.number().optional(),
        oneRmBench: z.number().optional(),
        oneRmOhp: z.number().optional(),
        oneRmDeadlift: z.number().optional(),
        oneRmLatpull: z.number().optional(),
        trainingGoal: z.string().optional(),
        sessionsPerWeek: z.number().optional(),
        sessionDuration: z.number().optional(),
        goalVolume: z.number().optional(),
        goalStrength: z.number().optional(),
        goalCardio: z.number().optional(),
        restTime: z.number().optional(),
        hasAiProgram: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await workoutDb.upsertUserProfile({
        userId: ctx.user.id,
        ...input,
      });
      return { success: true };
    }),

  // ========== Session Management ==========
  getNextSessionType: protectedProcedure.query(async ({ ctx }) => {
    return await workoutDb.getNextSessionType(ctx.user.id);
  }),

  startSession: protectedProcedure
    .input(
      z.object({
        sessionType: z.enum(["A", "B", "C"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sessionId = await workoutDb.createWorkoutSession({
        userId: ctx.user.id,
        sessionType: input.sessionType,
      });

      // Update last session type for rotation
      await workoutDb.updateLastSessionType(ctx.user.id, input.sessionType);

      return { sessionId };
    }),

  completeSession: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await workoutDb.completeWorkoutSession(input.sessionId);
      return { success: true };
    }),

  getSessionHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return await workoutDb.getUserWorkoutSessions(ctx.user.id, input.limit);
    }),

  getSessionWithLogs: protectedProcedure
    .input(
      z.object({
        sessionId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await workoutDb.getWorkoutSessionWithLogs(input.sessionId);
    }),

  // ========== Exercise Logging ==========
  logExercise: protectedProcedure
    .input(
      z.object({
        workoutSessionId: z.number(),
        exerciseKey: z.string(),
        exerciseTitle: z.string(),
        setNumber: z.number(),
        weight: z.number().optional(),
        reps: z.number().optional(),
        completed: z.number().optional().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const logId = await workoutDb.createExerciseLog(input);
      return { logId };
    }),

  updateExercise: protectedProcedure
    .input(
      z.object({
        logId: z.number(),
        weight: z.number().optional(),
        reps: z.number().optional(),
        completed: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { logId, ...data } = input;
      await workoutDb.updateExerciseLog(logId, data);
      return { success: true };
    }),

  getExerciseHistory: protectedProcedure
    .input(
      z.object({
        exerciseKey: z.string(),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      return await workoutDb.getExerciseHistory(
        ctx.user.id,
        input.exerciseKey,
        input.limit
      );
    }),

  // ========== Export ==========
  exportHistory: protectedProcedure.query(async ({ ctx }) => {
    const history = await workoutDb.exportWorkoutHistory(ctx.user.id);
    
    // Convert to CSV format
    const csvRows: string[] = [];
    csvRows.push("Date,Session Type,Exercise,Set,Weight (kg),Reps,Completed");

    for (const session of history) {
      const date = session.startedAt.toISOString().split("T")[0];
      for (const exercise of session.exercises) {
        csvRows.push(
          [
            date,
            session.sessionType,
            exercise.exerciseTitle,
            exercise.setNumber,
            exercise.weight || "",
            exercise.reps || "",
            exercise.completed ? "Yes" : "No",
          ].join(",")
        );
      }
    }

    return {
      csv: csvRows.join("\n"),
      json: history,
    };
  }),
});
