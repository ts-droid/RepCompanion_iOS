import { eq, desc, and } from "drizzle-orm";
import { getDb } from "./db";
import {
  workoutSessions,
  exerciseLogs,
  userProfiles,
  InsertWorkoutSession,
  InsertExerciseLog,
  InsertUserProfile,
} from "../drizzle/schema";

// ========== Workout Sessions ==========

export async function createWorkoutSession(data: InsertWorkoutSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(workoutSessions).values(data);
  return Number(result[0].insertId);
}

export async function completeWorkoutSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(workoutSessions)
    .set({ completedAt: new Date() })
    .where(eq(workoutSessions.id, sessionId));
}

export async function getUserWorkoutSessions(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(limit);
}

export async function getWorkoutSessionWithLogs(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const session = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .limit(1);

  if (session.length === 0) return null;

  const logs = await db
    .select()
    .from(exerciseLogs)
    .where(eq(exerciseLogs.workoutSessionId, sessionId));

  return {
    session: session[0],
    logs,
  };
}

// ========== Exercise Logs ==========

export async function createExerciseLog(data: InsertExerciseLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(exerciseLogs).values(data);
  return Number(result[0].insertId);
}

export async function updateExerciseLog(
  logId: number,
  data: { weight?: number; reps?: number; completed?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(exerciseLogs).set(data).where(eq(exerciseLogs.id, logId));
}

export async function getExerciseLogsBySession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(exerciseLogs)
    .where(eq(exerciseLogs.workoutSessionId, sessionId));
}

export async function getExerciseHistory(
  userId: number,
  exerciseKey: string,
  limit = 10
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get recent logs for this exercise across all sessions
  const logs = await db
    .select({
      log: exerciseLogs,
      session: workoutSessions,
    })
    .from(exerciseLogs)
    .innerJoin(
      workoutSessions,
      eq(exerciseLogs.workoutSessionId, workoutSessions.id)
    )
    .where(
      and(
        eq(workoutSessions.userId, userId),
        eq(exerciseLogs.exerciseKey, exerciseKey)
      )
    )
    .orderBy(desc(workoutSessions.startedAt))
    .limit(limit);

  return logs;
}

// ========== User Profiles ==========

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function upsertUserProfile(data: InsertUserProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserProfile(data.userId);

  if (existing) {
    await db
      .update(userProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userProfiles.userId, data.userId));
  } else {
    await db.insert(userProfiles).values(data);
  }
}

export async function getNextSessionType(userId: number): Promise<"A" | "B" | "C"> {
  const profile = await getUserProfile(userId);
  
  if (!profile || !profile.lastSessionType) {
    return "A"; // Start with A if no history
  }

  // Rotate: A → B → C → A
  const rotation: Record<string, "A" | "B" | "C"> = {
    A: "B",
    B: "C",
    C: "A",
  };

  return rotation[profile.lastSessionType] || "A";
}

export async function updateLastSessionType(
  userId: number,
  sessionType: "A" | "B" | "C"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(userProfiles)
    .set({ lastSessionType: sessionType })
    .where(eq(userProfiles.userId, userId));
}

// ========== Export Functions ==========

export async function exportWorkoutHistory(userId: number) {
  const sessions = await getUserWorkoutSessions(userId, 1000);
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const fullHistory = await Promise.all(
    sessions.map(async (session) => {
      const logs = await db
        .select()
        .from(exerciseLogs)
        .where(eq(exerciseLogs.workoutSessionId, session.id));

      return {
        ...session,
        exercises: logs,
      };
    })
  );

  return fullHistory;
}
