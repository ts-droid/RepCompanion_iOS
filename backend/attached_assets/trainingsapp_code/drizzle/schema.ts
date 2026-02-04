import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Workout sessions - tracks each training day
 */
export const workoutSessions = mysqlTable("workoutSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionType: varchar("sessionType", { length: 10 }).notNull(), // A, B, C
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  notes: text("notes"),
});

/**
 * Exercise logs - tracks weight and reps for each exercise in a session
 */
export const exerciseLogs = mysqlTable("exerciseLogs", {
  id: int("id").autoincrement().primaryKey(),
  workoutSessionId: int("workoutSessionId").notNull(),
  exerciseKey: varchar("exerciseKey", { length: 50 }).notNull(), // a1, b2, c3, etc.
  exerciseTitle: text("exerciseTitle").notNull(),
  setNumber: int("setNumber").notNull(), // 1, 2, 3, etc.
  weight: int("weight"), // in kg
  reps: int("reps"),
  completed: int("completed").default(0).notNull(), // 0 or 1 (boolean)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * User profiles - extended user information
 */
export const userProfiles = mysqlTable("userProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  age: int("age"),
  sex: varchar("sex", { length: 20 }), // male, female, other
  bodyWeight: int("bodyWeight"), // in kg
  height: int("height"), // in cm
  bodyFatPercent: int("bodyFatPercent"), // body fat percentage
  muscleMassPercent: int("muscleMassPercent"), // muscle mass percentage
  oneRmBench: int("oneRmBench"),
  oneRmOhp: int("oneRmOhp"),
  oneRmDeadlift: int("oneRmDeadlift"),
  oneRmLatpull: int("oneRmLatpull"),
  lastSessionType: varchar("lastSessionType", { length: 10 }), // A, B, C - for rotation
  trainingGoal: text("trainingGoal"),
  sessionsPerWeek: int("sessionsPerWeek"), // target sessions per week
  sessionDuration: int("sessionDuration"), // target duration in minutes
  goalVolume: int("goalVolume"), // 0-100 slider value
  goalStrength: int("goalStrength"), // 0-100 slider value
  goalCardio: int("goalCardio"), // 0-100 slider value
  restTime: int("restTime").default(60), // rest time in seconds: 30, 60, 90, 120
  hasAiProgram: int("hasAiProgram").default(0), // 0 = no program, 1 = has AI-generated program
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = typeof workoutSessions.$inferInsert;
export type ExerciseLog = typeof exerciseLogs.$inferSelect;
export type InsertExerciseLog = typeof exerciseLogs.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = typeof userProfiles.$inferInsert;