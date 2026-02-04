#!/usr/bin/env node

// scripts/railway-setup.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, index, jsonb, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  // Physical metrics
  age: integer("age"),
  sex: varchar("sex", { length: 20 }),
  bodyWeight: integer("body_weight"),
  height: integer("height"),
  bodyFatPercent: integer("body_fat_percent"),
  muscleMassPercent: integer("muscle_mass_percent"),
  // Strength benchmarks (1RM in kg)
  oneRmBench: integer("one_rm_bench"),
  oneRmOhp: integer("one_rm_ohp"),
  oneRmDeadlift: integer("one_rm_deadlift"),
  oneRmSquat: integer("one_rm_squat"),
  oneRmLatpull: integer("one_rm_latpull"),
  // Training preferences
  motivationType: varchar("motivation_type", { length: 50 }),
  trainingGoals: varchar("training_goals", { length: 50 }),
  trainingLevel: varchar("training_level", { length: 20 }),
  specificSport: varchar("specific_sport", { length: 100 }),
  goalStrength: integer("goal_strength").default(50),
  goalVolume: integer("goal_volume").default(50),
  goalEndurance: integer("goal_endurance").default(50),
  goalCardio: integer("goal_cardio").default(50),
  sessionsPerWeek: integer("sessions_per_week").default(3),
  sessionDuration: integer("session_duration").default(60),
  restTime: integer("rest_time").default(60),
  // UI preferences
  theme: varchar("theme", { length: 20 }).default("main"),
  avatarType: varchar("avatar_type", { length: 20 }).default("emoji"),
  // "emoji" | "image" | "generated"
  avatarEmoji: varchar("avatar_emoji", { length: 10 }).default("\u{1F4AA}"),
  avatarImageUrl: text("avatar_image_url"),
  // For uploaded images
  avatarConfig: jsonb("avatar_config"),
  // For generated avatar config
  // Onboarding tracking
  onboardingCompleted: boolean("onboarding_completed").default(false),
  appleHealthConnected: boolean("apple_health_connected").default(false),
  equipmentRegistered: boolean("equipment_registered").default(false),
  // AI program (deprecated - keeping for backward compatibility)
  hasAiProgram: boolean("has_ai_program").default(false),
  aiProgramData: jsonb("ai_program_data"),
  // Selected gym
  selectedGymId: varchar("selected_gym_id").references(() => gyms.id, { onDelete: "set null" }),
  // Program tracking
  lastCompletedTemplateId: varchar("last_completed_template_id"),
  lastSessionType: varchar("last_session_type", { length: 10 }),
  // Automatic pass progression (1→2→3→4→1)
  currentPassNumber: integer("current_pass_number").default(1),
  // Program generation rate limiting (max 5 per week)
  programGenerationsThisWeek: integer("program_generations_this_week").default(0),
  weekStartDate: timestamp("week_start_date"),
  // Admin access
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  forcePasswordChange: boolean("force_password_change").default(true).notNull(),
  totpSecret: text("totp_secret"),
  // Base32 encoded secret for Google Authenticator
  totpEnabled: boolean("totp_enabled").default(false).notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  // Can create new admins
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var gyms = pgTable("gyms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  location: varchar("location", { length: 300 }),
  latitude: text("latitude"),
  // Store as string for precision/simplicity in serialization
  longitude: text("longitude"),
  isPublic: boolean("is_public").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var userEquipment = pgTable("user_equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gymId: varchar("gym_id").notNull().references(() => gyms.id, { onDelete: "cascade" }),
  equipmentType: varchar("equipment_type", { length: 100 }).notNull(),
  equipmentName: varchar("equipment_name", { length: 200 }).notNull(),
  equipmentKey: varchar("equipment_key", { length: 40 }),
  available: boolean("available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  userEquipmentUnique: unique().on(table.gymId, table.equipmentName),
  idxUserEquipmentKey: index("idx_user_equipment_key").on(table.userId, table.gymId, table.equipmentKey)
}));
var gymPrograms = pgTable("gym_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gymId: varchar("gym_id").notNull().references(() => gyms.id, { onDelete: "cascade" }),
  programData: jsonb("program_data").notNull(),
  // Snapshot of templates when cycle started (protects against template edits mid-cycle)
  templateSnapshot: jsonb("template_snapshot"),
  snapshotCreatedAt: timestamp("snapshot_created_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  userGymUnique: unique().on(table.userId, table.gymId)
}));
var workoutSessions = pgTable("workout_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateId: varchar("template_id").references(() => programTemplates.id, { onDelete: "set null" }),
  sessionType: varchar("session_type", { length: 10 }).notNull(),
  sessionName: varchar("session_name", { length: 200 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  movergyScore: integer("movergy_score"),
  // Session snapshot data (for resume functionality)
  // Stores: { skippedExercises: number[] }
  snapshotData: jsonb("snapshot_data")
});
var exerciseLogs = pgTable("exercise_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workoutSessionId: varchar("workout_session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseKey: varchar("exercise_key", { length: 50 }).notNull(),
  exerciseTitle: text("exercise_title").notNull(),
  exerciseOrderIndex: integer("exercise_order_index").notNull(),
  // Position in template (0, 1, 2, 3...)
  setNumber: integer("set_number").notNull(),
  weight: integer("weight"),
  reps: integer("reps"),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var programTemplates = pgTable("program_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateName: varchar("template_name", { length: 100 }).notNull(),
  muscleFocus: varchar("muscle_focus", { length: 100 }),
  // e.g., "Överkropp - Push", "Ben & Rumpa"
  dayOfWeek: integer("day_of_week"),
  // 1=Monday, 2=Tuesday, ..., 7=Sunday
  estimatedDurationMinutes: integer("estimated_duration_minutes"),
  // AI's calculated session duration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var programTemplateExercises = pgTable("program_template_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => programTemplates.id, { onDelete: "cascade" }),
  exerciseKey: varchar("exercise_key", { length: 50 }).notNull(),
  exerciseName: varchar("exercise_name", { length: 200 }).notNull(),
  orderIndex: integer("order_index").notNull(),
  targetSets: integer("target_sets").notNull(),
  targetReps: varchar("target_reps", { length: 50 }).notNull(),
  // Increased from 20 to support longer strings like "5 x 20 sek intervaller"
  targetWeight: integer("target_weight"),
  requiredEquipment: text("required_equipment").array(),
  muscles: text("muscles").array(),
  notes: text("notes")
});
var exerciseStats = pgTable("exercise_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  exerciseKey: varchar("exercise_key", { length: 50 }).notNull(),
  exerciseName: varchar("exercise_name", { length: 200 }).notNull(),
  muscles: text("muscles").array(),
  avgWeight: integer("avg_weight"),
  maxWeight: integer("max_weight"),
  lastWeight: integer("last_weight"),
  totalVolume: integer("total_volume").default(0),
  totalSets: integer("total_sets").default(0),
  totalSessions: integer("total_sessions").default(0),
  recentWeights: jsonb("recent_weights"),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  userExerciseUnique: unique().on(table.userId, table.exerciseKey)
}));
var userTimeModel = pgTable("user_time_model", {
  userId: text("user_id").primaryKey(),
  workSecondsPer10Reps: integer("work_seconds_per_10_reps").notNull().default(30),
  restBetweenSetsSeconds: integer("rest_between_sets_seconds").notNull().default(90),
  restBetweenExercisesSeconds: integer("rest_between_exercises_seconds").notNull().default(120),
  warmupMinutesDefault: integer("warmup_minutes_default").notNull().default(8),
  cooldownMinutesDefault: integer("cooldown_minutes_default").notNull().default(5),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
var equipmentAliases = pgTable("equipment_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  equipmentKey: varchar("equipment_key", { length: 40 }).notNull(),
  alias: text("alias").notNull(),
  aliasNorm: text("alias_norm").notNull(),
  lang: varchar("lang", { length: 10 }).default("en"),
  source: varchar("source", { length: 20 }).default("seed"),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  uxEquipmentAliasesNorm: unique("ux_equipment_aliases_norm").on(table.aliasNorm)
}));
var exerciseAliases = pgTable("exercise_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: varchar("exercise_id", { length: 40 }).notNull(),
  alias: text("alias").notNull(),
  aliasNorm: text("alias_norm").notNull(),
  lang: varchar("lang", { length: 10 }).default("en"),
  source: varchar("source", { length: 20 }).default("seed"),
  createdAt: timestamp("created_at").notNull().defaultNow()
}, (table) => ({
  uxExerciseAliasesNorm: unique("ux_exercise_aliases_norm").on(table.aliasNorm)
}));
var exerciseCaps = pgTable("exercise_caps", {
  exerciseId: varchar("exercise_id", { length: 40 }).primaryKey(),
  minSets: integer("min_sets").notNull().default(1),
  maxSets: integer("max_sets").notNull().default(6)
});
var candidatePools = pgTable("candidate_pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scope: varchar("scope", { length: 10 }).notNull(),
  // 'global' | 'gym' | 'user'
  userId: text("user_id"),
  gymId: text("gym_id"),
  poolType: varchar("pool_type", { length: 30 }).notNull(),
  // 'hypertrophy'|'strength'|'sport_hockey'
  buckets: jsonb("buckets").notNull(),
  // JSON buckets of exercise_ids
  hash: varchar("hash", { length: 64 }).notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at")
}, (table) => ({
  idxCandidatePoolsLookup: index("idx_candidate_pools_lookup").on(table.scope, table.userId, table.gymId, table.poolType)
}));
var exercises = pgTable("exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: varchar("exercise_id", { length: 40 }),
  name: varchar("name", { length: 200 }).notNull().unique(),
  nameEn: varchar("name_en", { length: 200 }),
  description: text("description"),
  category: varchar("category", { length: 50 }).notNull(),
  difficulty: varchar("difficulty", { length: 20 }).notNull(),
  primaryMuscles: text("primary_muscles").array().notNull(),
  secondaryMuscles: text("secondary_muscles").array(),
  requiredEquipment: text("required_equipment").array().notNull(),
  movementPattern: varchar("movement_pattern", { length: 50 }),
  isCompound: boolean("is_compound").default(false).notNull(),
  youtubeUrl: text("youtube_url"),
  videoType: varchar("video_type", { length: 20 }),
  instructions: text("instructions"),
  requires1RM: boolean("requires_1rm").default(false),
  goodForBeginners: boolean("good_for_beginners").default(false),
  coreEngagement: boolean("core_engagement").default(false),
  genderSpecialization: varchar("gender_specialization", { length: 20 }),
  categories: text("categories").array(),
  aiSearchTerms: text("ai_search_terms").array(),
  trainingLevelPriority: text("training_level_priority").array(),
  equipmentMappingTags: text("equipment_mapping_tags").array(),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  uxExercisesExerciseId: unique("ux_exercises_exercise_id").on(table.exerciseId)
}));
var unmappedExercises = pgTable("unmapped_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiName: varchar("ai_name", { length: 200 }).notNull().unique(),
  suggestedMatch: varchar("suggested_match", { length: 200 }),
  count: integer("count").default(1).notNull(),
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var equipmentCatalog = pgTable("equipment_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull().unique(),
  nameEn: varchar("name_en", { length: 200 }),
  equipmentKey: varchar("equipment_key", { length: 40 }),
  category: varchar("category", { length: 50 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  uxEquipmentCatalogEquipmentKey: unique("ux_equipment_catalog_equipment_key").on(table.equipmentKey)
}));
var promoContent = pgTable("promo_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 50 }).notNull(),
  placement: varchar("placement", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }),
  description: text("description"),
  ctaText: varchar("cta_text", { length: 100 }),
  ctaUrl: text("cta_url"),
  partnerName: varchar("partner_name", { length: 100 }),
  imageUrl: text("image_url"),
  targetingRules: jsonb("targeting_rules"),
  isActive: boolean("is_active").default(true).notNull(),
  frequencyCapHours: integer("frequency_cap_hours").default(24),
  createdAt: timestamp("created_at").defaultNow()
});
var promoImpressions = pgTable("promo_impressions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  promoId: varchar("promo_id").notNull().references(() => promoContent.id, { onDelete: "cascade" }),
  placement: varchar("placement", { length: 50 }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var affiliateClicks = pgTable("affiliate_clicks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  promoId: varchar("promo_id").notNull().references(() => promoContent.id, { onDelete: "cascade" }),
  clickedUrl: text("clicked_url").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  pushEnabled: boolean("push_enabled").default(false).notNull(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  workoutReminders: boolean("workout_reminders").default(true).notNull(),
  motivationalQuotes: boolean("motivational_quotes").default(true).notNull(),
  affiliateOffers: boolean("affiliate_offers").default(false).notNull(),
  pushToken: text("push_token"),
  updatedAt: timestamp("updated_at").defaultNow()
});
var notificationSchedule = pgTable("notification_schedule", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sent: boolean("sent").default(false).notNull(),
  sentAt: timestamp("sent_at"),
  title: varchar("title", { length: 200 }),
  body: text("body"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow()
});
var trainingTips = pgTable("training_tips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  message: text("message").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  workoutTypes: text("workout_types").array().notNull().default(sql`ARRAY[]::text[]`),
  icon: varchar("icon", { length: 10 }).notNull(),
  relatedPromoPlacement: varchar("related_promo_placement", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  priority: integer("priority").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var profileTrainingTips = pgTable("profile_training_tips", {
  id: varchar("id").primaryKey(),
  // e.g., "TIP00001" from JSON
  tipText: text("tip_text").notNull(),
  ageGroup: varchar("age_group", { length: 20 }).notNull(),
  // "13–17", "18–29", "30–39", "40–59", "60+"
  sport: varchar("sport", { length: 100 }),
  // "fotboll", "golf", "allmän", etc. (null = general/non-sport-specific)
  category: varchar("category", { length: 100 }).notNull(),
  // "kost", "återhämtning", "blandad träning", "kondition", "periodisering", etc.
  gender: varchar("gender", { length: 10 }).notNull(),
  // "både", "man", "kvinna"
  trainingLevel: varchar("training_level", { length: 50 }).notNull(),
  // "helt nybörjare", "nybörjare", "medel", "van", "avancerad", "elit"
  affiliateLink: varchar("affiliate_link", { length: 500 }),
  // Optional: product link or affiliate URL
  wordCount: integer("word_count"),
  createdAt: timestamp("created_at").defaultNow()
});
var userSubscriptions = pgTable("user_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  status: varchar("status", { length: 50 }).notNull().default("free"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 200 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 200 }),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true
}).extend({
  motivationType: z.enum([
    "build_muscle",
    "better_health",
    "sport",
    "mobility",
    "rehabilitation",
    // Legacy Swedish keys for backward compatibility
    "fitness",
    "viktminskning",
    "h\xE4lsa_livsstil",
    "b\xE4ttre_h\xE4lsa",
    "bygga_muskler",
    "bli_r\xF6rligare"
  ]).optional(),
  trainingLevel: z.enum(["beginner", "intermediate", "advanced", "elite", "nyb\xF6rjare", "van", "mycket_van"]).optional()
});
var updateUserProfileSchema = z.object({
  theme: z.enum(["main", "forest", "purple", "ocean", "sunset", "slate", "crimson", "pink"]).optional(),
  avatarType: z.enum(["emoji", "image", "generated"]).optional(),
  avatarEmoji: z.string().max(10).optional(),
  avatarImageUrl: z.string().url().nullable().optional(),
  avatarConfig: z.any().optional(),
  // Flexible for avatar generator config
  motivationType: z.enum(["build_muscle", "better_health", "sport", "mobility", "rehabilitation", "fitness", "viktminskning", "h\xE4lsa_livsstil"]).optional(),
  trainingGoals: z.string().optional(),
  trainingLevel: z.enum(["beginner", "intermediate", "advanced", "elite", "nyb\xF6rjare", "van", "mycket_van"]).optional(),
  specificSport: z.string().nullable().optional(),
  goalStrength: z.number().min(0).max(100).optional(),
  goalVolume: z.number().min(0).max(100).optional(),
  goalEndurance: z.number().min(0).max(100).optional(),
  goalCardio: z.number().min(0).max(100).optional(),
  sessionsPerWeek: z.number().min(1).max(7).optional(),
  sessionDuration: z.number().min(15).max(180).optional(),
  oneRmBench: z.number().min(0).optional(),
  oneRmOhp: z.number().min(0).optional(),
  oneRmDeadlift: z.number().min(0).optional(),
  oneRmSquat: z.number().min(0).optional(),
  oneRmLatpull: z.number().min(0).optional(),
  selectedGymId: z.string().nullable().optional(),
  // Allow clearing/updating selected gym
  currentPassNumber: z.number().min(1).max(10).optional(),
  // Automatic pass progression (1→2→3→4→1)
  forceRegenerate: z.boolean().optional()
  // Force program regeneration even if settings unchanged
}).strict();
var insertGymSchema = createInsertSchema(gyms).omit({
  id: true,
  createdAt: true
});
var updateGymSchema = z.object({
  name: z.string().min(1, "Gymnamn kr\xE4vs"),
  location: z.string().optional(),
  latitude: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  isPublic: z.boolean().optional()
});
var insertEquipmentSchema = createInsertSchema(userEquipment).omit({
  id: true,
  createdAt: true
});
var insertGymProgramSchema = createInsertSchema(gymPrograms).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertWorkoutSessionSchema = createInsertSchema(workoutSessions).omit({
  id: true,
  startedAt: true
});
var insertExerciseLogSchema = createInsertSchema(exerciseLogs).omit({
  id: true,
  createdAt: true
});
var updateExerciseLogSchema = insertExerciseLogSchema.omit({
  workoutSessionId: true
}).partial();
var insertPromoContentSchema = createInsertSchema(promoContent).omit({
  id: true,
  createdAt: true
});
var insertPromoImpressionSchema = createInsertSchema(promoImpressions).omit({
  id: true,
  createdAt: true
});
var insertAffiliateClickSchema = createInsertSchema(affiliateClicks).omit({
  id: true,
  createdAt: true
});
var insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  updatedAt: true
});
var updateNotificationPreferencesSchema = insertNotificationPreferencesSchema.partial().omit({
  userId: true
});
var insertNotificationScheduleSchema = createInsertSchema(notificationSchedule).omit({
  id: true,
  createdAt: true
});
var insertTrainingTipSchema = createInsertSchema(trainingTips).omit({
  id: true,
  createdAt: true
}).extend({
  category: z.enum(["recovery", "progression", "safety", "hydration", "nutrition", "motivation"]),
  workoutTypes: z.array(z.string()).min(0).default([])
});
var insertProfileTrainingTipSchema = createInsertSchema(profileTrainingTips).omit({
  createdAt: true
}).extend({
  ageGroup: z.enum(["13\u201317", "18\u201329", "30\u201339", "40\u201359", "60+"]),
  gender: z.enum(["b\xE5de", "man", "kvinna"]),
  trainingLevel: z.enum(["helt nyb\xF6rjare", "nyb\xF6rjare", "medel", "van", "avancerad", "elit"])
});
var insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertProgramTemplateSchema = createInsertSchema(programTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertProgramTemplateExerciseSchema = createInsertSchema(programTemplateExercises).omit({
  id: true
});
var insertExerciseStatsSchema = createInsertSchema(exerciseStats).omit({
  id: true,
  updatedAt: true
});
var insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
  createdAt: true
});
var insertEquipmentCatalogSchema = createInsertSchema(equipmentCatalog).omit({
  id: true,
  createdAt: true
});
var insertUserTimeModelSchema = createInsertSchema(userTimeModel);
var insertEquipmentAliasSchema = createInsertSchema(equipmentAliases).omit({
  id: true,
  createdAt: true
});
var insertExerciseAliasSchema = createInsertSchema(exerciseAliases).omit({
  id: true,
  createdAt: true
});
var insertExerciseCapSchema = createInsertSchema(exerciseCaps);
var insertCandidatePoolSchema = createInsertSchema(candidatePools).omit({
  id: true,
  createdAt: true
});
var insertUnmappedExerciseSchema = createInsertSchema(unmappedExercises).omit({
  id: true,
  createdAt: true,
  firstSeen: true,
  lastSeen: true
});
var healthPlatformEnum = ["apple_health", "google_fit", "samsung_health", "fitbit", "oura", "whoop", "garmin"];
var healthConnectionStatusEnum = ["active", "disconnected", "error", "pending"];
var healthConnections = pgTable("health_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull(),
  // apple_health, google_fit, etc.
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  // active, disconnected, error, pending
  // Vital API user ID for this connection
  vitalUserId: varchar("vital_user_id", { length: 200 }),
  // Encrypted OAuth tokens (application-level encryption recommended)
  encryptedAccessToken: text("encrypted_access_token"),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  // Tracking
  lastSyncAt: timestamp("last_sync_at"),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  disconnectedAt: timestamp("disconnected_at"),
  // Error tracking
  lastError: text("last_error"),
  errorCount: integer("error_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  userIdIdx: index("health_connections_user_id_idx").on(table.userId),
  platformIdx: index("health_connections_platform_idx").on(table.platform),
  statusIdx: index("health_connections_status_idx").on(table.status),
  vitalUserIdIdx: index("health_connections_vital_user_id_idx").on(table.vitalUserId)
}));
var healthMetrics = pgTable("health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  connectionId: varchar("connection_id").references(() => healthConnections.id, { onDelete: "set null" }),
  metricType: varchar("metric_type", { length: 50 }).notNull(),
  // steps, calories_burned, sleep_duration_minutes, etc.
  value: integer("value").notNull(),
  // numeric value (convert floats to integers with scale)
  unit: varchar("unit", { length: 20 }).notNull(),
  // steps, kcal, minutes, bpm, etc.
  // Date tracking (one record per day per metric type)
  date: timestamp("date").notNull(),
  // Date of the metric (start of day)
  collectedAt: timestamp("collected_at").defaultNow().notNull(),
  // When we received the data
  // Optional metadata (JSON for extensibility)
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  // Unique constraint: one metric per user per type per day
  uniqueUserMetricDate: unique().on(table.userId, table.metricType, table.date),
  // Indexes for efficient queries
  userMetricDateIdx: index("health_metrics_user_metric_date_idx").on(table.userId, table.metricType, table.date.desc()),
  connectionCollectedIdx: index("health_metrics_connection_collected_idx").on(table.connectionId, table.collectedAt),
  dateIdx: index("health_metrics_date_idx").on(table.date.desc())
}));
var healthSyncLogs = pgTable("health_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  connectionId: varchar("connection_id").references(() => healthConnections.id, { onDelete: "set null" }),
  platform: varchar("platform", { length: 50 }).notNull(),
  syncType: varchar("sync_type", { length: 50 }).notNull(),
  // webhook, manual, scheduled
  status: varchar("status", { length: 20 }).notNull(),
  // success, error, partial
  metricsCount: integer("metrics_count").default(0).notNull(),
  errorMessage: text("error_message"),
  // Webhook payload hash for deduplication
  payloadHash: varchar("payload_hash", { length: 64 }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => ({
  userIdIdx: index("health_sync_logs_user_id_idx").on(table.userId),
  connectionIdIdx: index("health_sync_logs_connection_id_idx").on(table.connectionId),
  statusIdx: index("health_sync_logs_status_idx").on(table.status),
  createdAtIdx: index("health_sync_logs_created_at_idx").on(table.createdAt.desc())
}));
var insertHealthConnectionSchema = createInsertSchema(healthConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var updateHealthConnectionSchema = insertHealthConnectionSchema.partial().extend({
  status: z.enum(healthConnectionStatusEnum).optional(),
  platform: z.enum(healthPlatformEnum).optional()
});
var insertHealthMetricSchema = createInsertSchema(healthMetrics).omit({
  id: true,
  createdAt: true
});
var insertHealthSyncLogSchema = createInsertSchema(healthSyncLogs).omit({
  id: true,
  createdAt: true
});
var suggestAlternativeRequestSchema = z.object({
  originalExercise: z.object({
    title: z.string(),
    muscleGroups: z.array(z.string()).optional(),
    equipment: z.array(z.string()).optional()
  }),
  targetMuscleGroups: z.array(z.string()),
  availableEquipment: z.array(z.object({
    equipmentName: z.string()
  }))
});
var alternativeExerciseSchema = z.object({
  title: z.string(),
  muscleGroups: z.array(z.string()),
  equipment: z.array(z.string()),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  description: z.string()
});
var suggestAlternativeResponseSchema = z.object({
  alternatives: z.array(alternativeExerciseSchema).length(3)
});
var generateProgramRequestSchema = z.object({
  force: z.boolean().optional()
}).strict();
var trackPromoImpressionSchema = z.object({
  placement: z.string().min(1),
  metadata: z.record(z.unknown()).optional()
});
var trackAffiliateClickSchema = z.object({
  metadata: z.record(z.unknown()).optional()
});
var promoIdParamSchema = z.object({
  id: z.string().min(1)
});
var promoPlacementParamSchema = z.object({
  placement: z.string().min(1)
});

// scripts/railway-setup.ts
import { eq } from "drizzle-orm";
var { Pool } = pkg;
async function runSetup() {
  console.log("[RAILWAY-SETUP] \u{1F680} Starting database setup...");
  if (!process.env.DATABASE_URL) {
    console.error("[RAILWAY-SETUP] \u274C DATABASE_URL environment variable is not set");
    process.exit(1);
  }
  try {
    console.log("[RAILWAY-SETUP] \u{1F4C2} Running migrations...");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("[RAILWAY-SETUP] \u2705 Migrations completed!");
    console.log("[RAILWAY-SETUP] \u{1F331} Checking for default admin...");
    const defaultEmail = "thomas@recompute.it";
    const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, defaultEmail));
    if (existing) {
      console.log(`[RAILWAY-SETUP] \u2139\uFE0F  Admin user ${defaultEmail} already exists`);
    } else {
      console.log("[RAILWAY-SETUP] Creating default admin user...");
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash("qwerty123456", 10);
      await db.insert(adminUsers).values({
        email: defaultEmail,
        passwordHash,
        forcePasswordChange: true,
        isSuperAdmin: true,
        totpEnabled: false
      });
      console.log("[RAILWAY-SETUP] \u2705 Default admin created!");
      console.log(`[RAILWAY-SETUP] Email: ${defaultEmail}`);
      console.log("[RAILWAY-SETUP] Password: qwerty123456 (must change on first login)");
    }
    console.log("\n[RAILWAY-SETUP] \u{1F389} Setup completed successfully!");
    console.log("[RAILWAY-SETUP] Admin login: https://repcompanionserver-production.up.railway.app/admin/login");
    process.exit(0);
  } catch (error) {
    console.error("[RAILWAY-SETUP] \u274C Setup failed:", error);
    process.exit(1);
  }
}
runSetup();
