import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, index, jsonb, unique, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ========== AUTH TABLES (Required by Replit Auth) ==========

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table - mandatory for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ========== FITNESS APP TABLES ==========

// User profiles - extended fitness information
export const userProfiles = pgTable("user_profiles", {
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
  restTime: integer("rest_time").default(60), // Deprecated - use restTimeBetweenSets instead
  restTimeBetweenSets: integer("rest_time_between_sets").default(90), // Seconds between sets
  restTimeBetweenExercises: integer("rest_time_between_exercises").default(120), // Seconds between exercises
  
  // UI preferences
  theme: varchar("theme", { length: 20 }).default("main"),
  avatarType: varchar("avatar_type", { length: 20 }).default("emoji"), // "emoji" | "image" | "generated"
  avatarEmoji: varchar("avatar_emoji", { length: 10 }).default("💪"),
  avatarImageUrl: text("avatar_image_url"), // For uploaded images
  avatarConfig: jsonb("avatar_config"), // For generated avatar config
  
  // Localization
  language: varchar("language", { length: 5 }).default("en"),
  
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
  
  // Generation status
  isGeneratingProgram: boolean("is_generating_program").default(false),
  
  // Program generation rate limiting (max 5 per week)
  programGenerationsThisWeek: integer("program_generations_this_week").default(0),
  weekStartDate: timestamp("week_start_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Gyms - user's gym locations
export const gyms = pgTable("gyms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  location: varchar("location", { length: 300 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Equipment available at user's gym
export const userEquipment = pgTable("user_equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gymId: varchar("gym_id").notNull().references(() => gyms.id, { onDelete: "cascade" }),
  equipmentType: varchar("equipment_type", { length: 100 }).notNull(),
  equipmentName: varchar("equipment_name", { length: 200 }).notNull(),
  available: boolean("available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userEquipmentUnique: unique().on(table.gymId, table.equipmentName),
}));

// Gym programs - AI-generated workout programs per gym
export const gymPrograms = pgTable("gym_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gymId: varchar("gym_id").notNull().references(() => gyms.id, { onDelete: "cascade" }),
  programData: jsonb("program_data").notNull(),
  
  // Snapshot of templates when cycle started (protects against template edits mid-cycle)
  templateSnapshot: jsonb("template_snapshot"),
  snapshotCreatedAt: timestamp("snapshot_created_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userGymUnique: unique().on(table.userId, table.gymId),
}));

// Workout sessions - tracks each training day
export const workoutSessions = pgTable("workout_sessions", {
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
  snapshotData: jsonb("snapshot_data"),
});

// Exercise logs - tracks weight and reps for each exercise
export const exerciseLogs = pgTable("exercise_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workoutSessionId: varchar("workout_session_id").notNull().references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseKey: varchar("exercise_key", { length: 50 }).notNull(),
  exerciseTitle: text("exercise_title").notNull(),
  exerciseOrderIndex: integer("exercise_order_index").notNull(), // Position in template (0, 1, 2, 3...)
  setNumber: integer("set_number").notNull(),
  weight: integer("weight"),
  reps: integer("reps"),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Program templates - weekly workout passes (Pass A, B, C, etc.)
export const programTemplates = pgTable("program_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateName: varchar("template_name", { length: 100 }).notNull(),
  muscleFocus: varchar("muscle_focus", { length: 100 }), // e.g., "Överkropp - Push", "Ben & Rumpa"
  dayOfWeek: integer("day_of_week"), // 1=Monday, 2=Tuesday, ..., 7=Sunday
  estimatedDurationMinutes: integer("estimated_duration_minutes"), // AI's calculated session duration
  warmupDescription: text("warmup_description"), // AI generated warm-up suggestions
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Program template exercises - normalized exercise data per program
export const programTemplateExercises = pgTable("program_template_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => programTemplates.id, { onDelete: "cascade" }),
  exerciseKey: varchar("exercise_key", { length: 200 }).notNull(),
  exerciseName: varchar("exercise_name", { length: 200 }).notNull(),
  orderIndex: integer("order_index").notNull(),
  targetSets: integer("target_sets").notNull(),
  targetReps: varchar("target_reps", { length: 50 }).notNull(), // Increased from 20 to support longer strings like "5 x 20 sek intervaller"
  targetWeight: integer("target_weight"),
  requiredEquipment: text("required_equipment").array(),
  muscles: text("muscles").array(),
  notes: text("notes"),
});

// Exercise stats - tracks weight history and performance for smart suggestions
export const exerciseStats = pgTable("exercise_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  exerciseKey: varchar("exercise_key", { length: 200 }).notNull(),
  exerciseName: varchar("exercise_name", { length: 200 }).notNull(),
  muscles: text("muscles").array(),
  avgWeight: integer("avg_weight"),
  maxWeight: integer("max_weight"),
  lastWeight: integer("last_weight"),
  totalVolume: integer("total_volume").default(0),
  totalSets: integer("total_sets").default(0),
  totalSessions: integer("total_sessions").default(0),
  recentWeights: jsonb("recent_weights"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userExerciseUnique: unique().on(table.userId, table.exerciseKey),
}));

// Cached programs - stores AI-generated programs for reuse
export const cachedPrograms = pgTable("cached_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // null = global cache
  trainingLevel: varchar("training_level", { length: 50 }).notNull(),
  motivationType: varchar("motivation_type", { length: 50 }).notNull(),
  sessionsPerWeek: integer("sessions_per_week").notNull(),
  sessionDurationMinutes: integer("session_duration_minutes").notNull(),
  equipmentHash: varchar("equipment_hash", { length: 64 }), // Hash of available equipment
  programData: jsonb("program_data").notNull(),
  analysisData: jsonb("analysis_data"),
  isGlobal: boolean("is_global").default(false).notNull(),
  usageCount: integer("usage_count").default(0).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CachedProgram = typeof cachedPrograms.$inferSelect;
export type InsertCachedProgram = typeof cachedPrograms.$inferInsert;

// Exercise catalog - master list of all exercises with metadata
export const exercises = pgTable("exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // exerciseId removed - column doesn't exist in database
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
  createdAt: timestamp("created_at").defaultNow(),
});

// Unmapped exercises - tracks AI-generated exercises not found in catalog
export const unmappedExercises = pgTable("unmapped_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiName: varchar("ai_name", { length: 200 }).notNull().unique(),
  suggestedMatch: varchar("suggested_match", { length: 200 }),
  matchedExerciseId: varchar("matched_exercise_id").references(() => exercises.id, { onDelete: "set null" }), // Set when manually matched
  count: integer("count").default(1).notNull(),
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Exercise aliases - stores manually matched aliases for future automatic matching
export const exerciseAliases = pgTable("exercise_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  exerciseId: varchar("exercise_id").notNull().references(() => exercises.id, { onDelete: "cascade" }),
  aliasName: varchar("alias_name", { length: 200 }).notNull(), // Normalized AI-generated name
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }), // Admin user who created the match
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  aliasUnique: unique().on(table.exerciseId, table.aliasName), // One alias per exercise
}));


// Unmapped equipment - tracks AI-detected equipment not in catalog
export const unmappedEquipment = pgTable("unmapped_equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  aiName: varchar("ai_name", { length: 200 }).notNull().unique(),
  suggestedMatch: varchar("suggested_match", { length: 200 }),
  matchedEquipmentId: varchar("matched_equipment_id").references(() => equipmentCatalog.id, { onDelete: "set null" }),
  count: integer("count").default(1).notNull(),
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Equipment aliases - maps AI names to catalog equipment
export const equipmentAliases = pgTable("equipment_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  equipmentId: varchar("equipment_id").notNull().references(() => equipmentCatalog.id, { onDelete: "cascade" }),
  aliasName: varchar("alias_name", { length: 200 }).notNull(),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  equipmentAliasUnique: unique().on(table.equipmentId, table.aliasName),
}));

// ========== AI PATTERN CACHING TABLES ==========

// AI program patterns - caches complete AI workout generation responses
export const aiProgramPatterns = pgTable("ai_program_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Matching keys - used to find cached patterns
  trainingGoal: varchar("training_goal", { length: 50 }).notNull(), // "strength", "hypertrophy", "endurance"
  trainingLevel: varchar("training_level", { length: 20 }).notNull(), // "beginner", "intermediate", "advanced"
  daysPerWeek: integer("days_per_week").notNull(),
  sessionDuration: integer("session_duration").notNull(), // minutes
  equipmentHash: varchar("equipment_hash", { length: 64 }).notNull(), // SHA256 of sorted equipment list
  
  // Goal balance (0-100 for each)
  goalStrength: integer("goal_strength").default(50),
  goalVolume: integer("goal_volume").default(50),
  goalEndurance: integer("goal_endurance").default(50),
  goalCardio: integer("goal_cardio").default(50),
  
  // Cached data
  programStructure: jsonb("program_structure").notNull(), // Split type, weekly structure
  workoutTemplates: jsonb("workout_templates").notNull(), // Array of workout definitions
  rawAiResponse: jsonb("raw_ai_response"), // Original AI response for debugging
  
  // Metadata
  aiProvider: varchar("ai_provider", { length: 20 }).notNull(), // "gemini", "deepseek"
  aiModel: varchar("ai_model", { length: 50 }),
  generationTimeMs: integer("generation_time_ms"), // How long AI took
  
  // Usage stats
  usageCount: integer("usage_count").default(1).notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pattern_matching").on(table.trainingGoal, table.trainingLevel, table.daysPerWeek),
  index("idx_equipment_hash").on(table.equipmentHash),
]);

// Exercise selection rules - stores which exercises AI selects for specific contexts
export const exerciseSelectionRules = pgTable("exercise_selection_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Matching keys
  targetMuscle: varchar("target_muscle", { length: 50 }).notNull(), // "chest", "back", "legs"
  trainingGoal: varchar("training_goal", { length: 50 }).notNull(), // "strength", "hypertrophy"
  trainingLevel: varchar("training_level", { length: 20 }).notNull(),
  requiredEquipment: text("required_equipment").array(), // Equipment needed for this exercise
  
  // Exercise details
  exerciseId: varchar("exercise_id").references(() => exercises.id, { onDelete: "set null" }),
  exerciseName: varchar("exercise_name", { length: 100 }).notNull(),
  exerciseKey: varchar("exercise_key", { length: 100 }),
  
  // Default parameters
  defaultSets: integer("default_sets").default(3),
  defaultReps: varchar("default_reps", { length: 20 }).default("8-12"), // Can be range like "8-12" or fixed "5"
  defaultRestSeconds: integer("default_rest_seconds").default(90),
  
  // Priority (1 = primary choice, 2 = secondary, etc.)
  priority: integer("priority").default(1).notNull(),
  
  // Stats
  selectionCount: integer("selection_count").default(1).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_selection_muscle_goal").on(table.targetMuscle, table.trainingGoal),
  index("idx_selection_exercise").on(table.exerciseId),
]);

// Equipment substitutions - stores equipment replacement rules
export const equipmentSubstitutions = pgTable("equipment_substitutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Original equipment
  originalEquipment: varchar("original_equipment", { length: 100 }).notNull(),
  originalEquipmentId: varchar("original_equipment_id").references(() => equipmentCatalog.id, { onDelete: "set null" }),
  
  // Substitute equipment
  substituteEquipment: varchar("substitute_equipment", { length: 100 }).notNull(),
  substituteEquipmentId: varchar("substitute_equipment_id").references(() => equipmentCatalog.id, { onDelete: "set null" }),
  
  // Context - when is this substitution valid?
  exerciseContext: varchar("exercise_context", { length: 100 }), // "bench_press", "squat", or null for general
  muscleContext: varchar("muscle_context", { length: 50 }), // "chest", "legs", or null for any
  
  // Adjustment
  weightAdjustment: real("weight_adjustment").default(1.0), // 0.80 = 80% of original weight
  notes: text("notes"),
  
  // Stats
  usageCount: integer("usage_count").default(0).notNull(),
  successRate: real("success_rate"), // User feedback based (future)
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_substitution_original").on(table.originalEquipment),
  index("idx_substitution_context").on(table.exerciseContext),
]);

// Type exports for the new tables
export type AiProgramPattern = typeof aiProgramPatterns.$inferSelect;
export type InsertAiProgramPattern = typeof aiProgramPatterns.$inferInsert;
export type ExerciseSelectionRule = typeof exerciseSelectionRules.$inferSelect;
export type InsertExerciseSelectionRule = typeof exerciseSelectionRules.$inferInsert;
export type EquipmentSubstitution = typeof equipmentSubstitutions.$inferSelect;
export type InsertEquipmentSubstitution = typeof equipmentSubstitutions.$inferInsert;

// Equipment catalog - master list of all equipment types
export const equipmentCatalog = pgTable("equipment_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull().unique(),
  nameEn: varchar("name_en", { length: 200 }),
  category: varchar("category", { length: 50 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ========== MONETIZATION TABLES ==========

// Promo content - stores ad/affiliate campaigns
export const promoContent = pgTable("promo_content", {
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
  createdAt: timestamp("created_at").defaultNow(),
});

// Promo impressions - tracks when ads are shown
export const promoImpressions = pgTable("promo_impressions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  promoId: varchar("promo_id").notNull().references(() => promoContent.id, { onDelete: "cascade" }),
  placement: varchar("placement", { length: 50 }).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Affiliate clicks - tracks when users click affiliate links
export const affiliateClicks = pgTable("affiliate_clicks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  promoId: varchar("promo_id").notNull().references(() => promoContent.id, { onDelete: "cascade" }),
  clickedUrl: text("clicked_url").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========== NOTIFICATION TABLES ==========

// Notification preferences - user notification settings
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  pushEnabled: boolean("push_enabled").default(false).notNull(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  workoutReminders: boolean("workout_reminders").default(true).notNull(),
  motivationalQuotes: boolean("motivational_quotes").default(true).notNull(),
  affiliateOffers: boolean("affiliate_offers").default(false).notNull(),
  pushToken: text("push_token"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notification schedule - scheduled notifications
export const notificationSchedule = pgTable("notification_schedule", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sent: boolean("sent").default(false).notNull(),
  sentAt: timestamp("sent_at"),
  title: varchar("title", { length: 200 }),
  body: text("body"),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Training tips - database-stored training advice
export const trainingTips = pgTable("training_tips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  message: text("message").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  workoutTypes: text("workout_types").array().notNull().default(sql`ARRAY[]::text[]`),
  icon: varchar("icon", { length: 10 }).notNull(),
  relatedPromoPlacement: varchar("related_promo_placement", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  priority: integer("priority").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Profile-based training tips - granular advice filtered by age, sport, gender, level
export const profileTrainingTips = pgTable("profile_training_tips", {
  id: varchar("id").primaryKey(), // e.g., "TIP00001" from JSON
  tipText: text("tip_text").notNull(),
  ageGroup: varchar("age_group", { length: 20 }).notNull(), // "13–17", "18–29", "30–39", "40–59", "60+"
  sport: varchar("sport", { length: 100 }), // "fotboll", "golf", "allmän", etc. (null = general/non-sport-specific)
  category: varchar("category", { length: 100 }).notNull(), // "kost", "återhämtning", "blandad träning", "kondition", "periodisering", etc.
  gender: varchar("gender", { length: 10 }).notNull(), // "både", "man", "kvinna"
  trainingLevel: varchar("training_level", { length: 50 }).notNull(), // "helt nybörjare", "nybörjare", "medel", "van", "avancerad", "elit"
  affiliateLink: varchar("affiliate_link", { length: 500 }), // Optional: product link or affiliate URL
  wordCount: integer("word_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ========== SUBSCRIPTION TABLES ==========

// User subscriptions - premium subscription status
export const userSubscriptions = pgTable("user_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  status: varchar("status", { length: 50 }).notNull().default("free"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 200 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 200 }),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ========== SCHEMA EXPORTS ==========

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  motivationType: z.enum(["fitness", "viktminskning", "rehabilitering", "hälsa_livsstil", "bättre_hälsa", "bygga_muskler", "sport", "bli_rörligare"]).optional(),
  trainingLevel: z.enum(["nybörjare", "van", "mycket_van", "elit"]).optional(),
});

export const updateUserProfileSchema = z.object({
  theme: z.enum(["main", "forest", "purple", "ocean", "sunset", "slate", "crimson", "pink"]).optional(),
  avatarType: z.enum(["emoji", "image", "generated"]).optional(),
  avatarEmoji: z.string().max(10).optional(),
  avatarImageUrl: z.string().url().nullable().optional(),
  avatarConfig: z.any().optional(), // Flexible for avatar generator config
  motivationType: z.enum(["fitness", "viktminskning", "rehabilitering", "hälsa_livsstil", "bättre_hälsa", "bygga_muskler", "sport", "bli_rörligare"]).optional(),
  trainingGoals: z.string().optional(),
  trainingLevel: z.enum(["nybörjare", "van", "mycket_van", "elit"]).optional(),
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
  selectedGymId: z.string().nullable().optional(), // Allow clearing/updating selected gym
  currentPassNumber: z.number().min(1).max(10).optional(), // Automatic pass progression (1→2→3→4→1)
  forceRegenerate: z.boolean().optional(), // Force program regeneration even if settings unchanged
  hasAiProgram: z.boolean().optional(),
  aiProgramData: z.any().optional(),
}).strict();

export const insertGymSchema = createInsertSchema(gyms).omit({
  id: true,
  createdAt: true,
});

export const updateGymSchema = z.object({
  name: z.string().min(1, "Gymnamn krävs"),
  location: z.string().optional(),
});

export const insertEquipmentSchema = createInsertSchema(userEquipment).omit({
  id: true,
  createdAt: true,
});

export const insertGymProgramSchema = createInsertSchema(gymPrograms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkoutSessionSchema = createInsertSchema(workoutSessions).omit({
  id: true,
  startedAt: true,
});

export const insertExerciseLogSchema = createInsertSchema(exerciseLogs).omit({
  id: true,
  createdAt: true,
});

export const updateExerciseLogSchema = insertExerciseLogSchema.omit({
  workoutSessionId: true,
}).partial();

export const insertPromoContentSchema = createInsertSchema(promoContent).omit({
  id: true,
  createdAt: true,
});

export const insertPromoImpressionSchema = createInsertSchema(promoImpressions).omit({
  id: true,
  createdAt: true,
});

export const insertAffiliateClickSchema = createInsertSchema(affiliateClicks).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  updatedAt: true,
});

export const updateNotificationPreferencesSchema = insertNotificationPreferencesSchema.partial().omit({
  userId: true,
});

export const insertNotificationScheduleSchema = createInsertSchema(notificationSchedule).omit({
  id: true,
  createdAt: true,
});

export const insertTrainingTipSchema = createInsertSchema(trainingTips).omit({
  id: true,
  createdAt: true,
}).extend({
  category: z.enum(["recovery", "progression", "safety", "hydration", "nutrition", "motivation"]),
  workoutTypes: z.array(z.string()).min(0).default([]),
});

export const insertProfileTrainingTipSchema = createInsertSchema(profileTrainingTips).omit({
  createdAt: true,
}).extend({
  ageGroup: z.enum(["13–17", "18–29", "30–39", "40–59", "60+"]),
  gender: z.enum(["både", "man", "kvinna"]),
  trainingLevel: z.enum(["helt nybörjare", "nybörjare", "medel", "van", "avancerad", "elit"]),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProgramTemplateSchema = createInsertSchema(programTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProgramTemplateExerciseSchema = createInsertSchema(programTemplateExercises).omit({
  id: true,
});

export const insertExerciseStatsSchema = createInsertSchema(exerciseStats).omit({
  id: true,
  updatedAt: true,
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
  createdAt: true,
});

export const insertEquipmentCatalogSchema = createInsertSchema(equipmentCatalog).omit({
  id: true,
  createdAt: true,
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof updateUserProfileSchema>;

export type Gym = typeof gyms.$inferSelect;
export type InsertGym = z.infer<typeof insertGymSchema>;

export type UserEquipment = typeof userEquipment.$inferSelect;
export type InsertUserEquipment = z.infer<typeof insertEquipmentSchema>;

export type GymProgram = typeof gymPrograms.$inferSelect;
export type InsertGymProgram = z.infer<typeof insertGymProgramSchema>;

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;

export type ExerciseLog = typeof exerciseLogs.$inferSelect;
export type InsertExerciseLog = z.infer<typeof insertExerciseLogSchema>;
export type UpdateExerciseLog = z.infer<typeof updateExerciseLogSchema>;

export type PromoContent = typeof promoContent.$inferSelect;
export type InsertPromoContent = z.infer<typeof insertPromoContentSchema>;

export type PromoImpression = typeof promoImpressions.$inferSelect;
export type InsertPromoImpression = z.infer<typeof insertPromoImpressionSchema>;

export type AffiliateClick = typeof affiliateClicks.$inferSelect;
export type InsertAffiliateClick = z.infer<typeof insertAffiliateClickSchema>;

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type UpdateNotificationPreferences = z.infer<typeof updateNotificationPreferencesSchema>;

export type NotificationSchedule = typeof notificationSchedule.$inferSelect;
export type InsertNotificationSchedule = z.infer<typeof insertNotificationScheduleSchema>;

export type TrainingTip = typeof trainingTips.$inferSelect;
export type InsertTrainingTip = z.infer<typeof insertTrainingTipSchema>;

export type ProfileTrainingTip = typeof profileTrainingTips.$inferSelect;
export type InsertProfileTrainingTip = z.infer<typeof insertProfileTrainingTipSchema>;

export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;

export type ProgramTemplate = typeof programTemplates.$inferSelect;
export type InsertProgramTemplate = z.infer<typeof insertProgramTemplateSchema>;

export type ProgramTemplateExercise = typeof programTemplateExercises.$inferSelect;
export type InsertProgramTemplateExercise = z.infer<typeof insertProgramTemplateExerciseSchema>;

export type ExerciseStats = typeof exerciseStats.$inferSelect;
export type InsertExerciseStats = z.infer<typeof insertExerciseStatsSchema>;

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = z.infer<typeof insertExerciseSchema>;

export type EquipmentCatalog = typeof equipmentCatalog.$inferSelect;
export type InsertEquipmentCatalog = z.infer<typeof insertEquipmentCatalogSchema>;

// ========== HEALTH DATA INTEGRATION (Vital API) ==========

// Health platform enum (apple_health, google_fit, samsung_health)
export const healthPlatformEnum = ["apple_health", "google_fit", "samsung_health", "fitbit", "oura", "whoop", "garmin"] as const;
export const healthConnectionStatusEnum = ["active", "disconnected", "error", "pending"] as const;
export const healthMetricTypeEnum = [
  "steps",
  "calories_burned",
  "active_minutes",
  "distance_meters",
  "sleep_duration_minutes",
  "sleep_quality_score",
  "heart_rate_avg",
  "heart_rate_resting",
  "heart_rate_variability",
  "vo2_max"
] as const;

// Health connections - OAuth connections to health platforms via Vital API
export const healthConnections = pgTable("health_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  platform: varchar("platform", { length: 50 }).notNull(), // apple_health, google_fit, etc.
  status: varchar("status", { length: 20 }).default("pending").notNull(), // active, disconnected, error, pending
  
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
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("health_connections_user_id_idx").on(table.userId),
  platformIdx: index("health_connections_platform_idx").on(table.platform),
  statusIdx: index("health_connections_status_idx").on(table.status),
  vitalUserIdIdx: index("health_connections_vital_user_id_idx").on(table.vitalUserId),
}));

// Health metrics - Daily aggregated health data from connected platforms
export const healthMetrics = pgTable("health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  connectionId: varchar("connection_id").references(() => healthConnections.id, { onDelete: "set null" }),
  
  metricType: varchar("metric_type", { length: 50 }).notNull(), // steps, calories_burned, sleep_duration_minutes, etc.
  value: integer("value").notNull(), // numeric value (convert floats to integers with scale)
  unit: varchar("unit", { length: 20 }).notNull(), // steps, kcal, minutes, bpm, etc.
  
  // Date tracking (one record per day per metric type)
  date: timestamp("date").notNull(), // Date of the metric (start of day)
  collectedAt: timestamp("collected_at").defaultNow().notNull(), // When we received the data
  
  // Optional metadata (JSON for extensibility)
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint: one metric per user per type per day
  uniqueUserMetricDate: unique().on(table.userId, table.metricType, table.date),
  // Indexes for efficient queries
  userMetricDateIdx: index("health_metrics_user_metric_date_idx").on(table.userId, table.metricType, table.date.desc()),
  connectionCollectedIdx: index("health_metrics_connection_collected_idx").on(table.connectionId, table.collectedAt),
  dateIdx: index("health_metrics_date_idx").on(table.date.desc()),
}));

// Health sync logs - Track sync operations for debugging and webhook replay
export const healthSyncLogs = pgTable("health_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  connectionId: varchar("connection_id").references(() => healthConnections.id, { onDelete: "set null" }),
  
  platform: varchar("platform", { length: 50 }).notNull(),
  syncType: varchar("sync_type", { length: 50 }).notNull(), // webhook, manual, scheduled
  status: varchar("status", { length: 20 }).notNull(), // success, error, partial
  
  metricsCount: integer("metrics_count").default(0).notNull(),
  errorMessage: text("error_message"),
  
  // Webhook payload hash for deduplication
  payloadHash: varchar("payload_hash", { length: 64 }),
  
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("health_sync_logs_user_id_idx").on(table.userId),
  connectionIdIdx: index("health_sync_logs_connection_id_idx").on(table.connectionId),
  statusIdx: index("health_sync_logs_status_idx").on(table.status),
  createdAtIdx: index("health_sync_logs_created_at_idx").on(table.createdAt.desc()),
}));

// Zod schemas for health connections
export const insertHealthConnectionSchema = createInsertSchema(healthConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateHealthConnectionSchema = insertHealthConnectionSchema.partial().extend({
  status: z.enum(healthConnectionStatusEnum).optional(),
  platform: z.enum(healthPlatformEnum).optional(),
});

// Zod schemas for health metrics
export const insertHealthMetricSchema = createInsertSchema(healthMetrics).omit({
  id: true,
  createdAt: true,
});

// Zod schemas for sync logs
export const insertHealthSyncLogSchema = createInsertSchema(healthSyncLogs).omit({
  id: true,
  createdAt: true,
});

// Types
export type HealthConnection = typeof healthConnections.$inferSelect;
export type InsertHealthConnection = z.infer<typeof insertHealthConnectionSchema>;
export type UpdateHealthConnection = z.infer<typeof updateHealthConnectionSchema>;

export type HealthMetric = typeof healthMetrics.$inferSelect;
export type InsertHealthMetric = z.infer<typeof insertHealthMetricSchema>;

export type HealthSyncLog = typeof healthSyncLogs.$inferSelect;
export type InsertHealthSyncLog = z.infer<typeof insertHealthSyncLogSchema>;

// AI Alternative Exercise Suggestion
export const suggestAlternativeRequestSchema = z.object({
  originalExercise: z.object({
    title: z.string(),
    muscleGroups: z.array(z.string()).optional(),
    equipment: z.array(z.string()).optional(),
  }),
  targetMuscleGroups: z.array(z.string()),
  availableEquipment: z.array(z.object({
    equipmentName: z.string(),
  })),
});

export const alternativeExerciseSchema = z.object({
  title: z.string(),
  muscleGroups: z.array(z.string()),
  equipment: z.array(z.string()),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  description: z.string(),
});

export const suggestAlternativeResponseSchema = z.object({
  alternatives: z.array(alternativeExerciseSchema).length(3),
});

export type SuggestAlternativeRequest = z.infer<typeof suggestAlternativeRequestSchema>;
export type AlternativeExercise = z.infer<typeof alternativeExerciseSchema>;
export type SuggestAlternativeResponse = z.infer<typeof suggestAlternativeResponseSchema>;

// Program generation request schema
export const generateProgramRequestSchema = z.object({
  force: z.boolean().optional(),
  gymId: z.string().optional(),
  equipmentIds: z.array(z.string()).optional(),
  
  // Optional goal overrides
  goalStrength: z.number().optional(),
  goalVolume: z.number().optional(),
  goalEndurance: z.number().optional(),
  goalCardio: z.number().optional(),
  sessionsPerWeek: z.number().optional(),
  sessionDuration: z.number().optional(),
}).strict();

export type GenerateProgramRequest = z.infer<typeof generateProgramRequestSchema>;

// Promo tracking schemas
export const trackPromoImpressionSchema = z.object({
  placement: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const trackAffiliateClickSchema = z.object({
  metadata: z.record(z.unknown()).optional(),
});

export const promoIdParamSchema = z.object({
  id: z.string().min(1),
});

export const promoPlacementParamSchema = z.object({
  placement: z.string().min(1),
});

export type TrackPromoImpression = z.infer<typeof trackPromoImpressionSchema>;
export type TrackAffiliateClick = z.infer<typeof trackAffiliateClickSchema>;
export type PromoIdParam = z.infer<typeof promoIdParamSchema>;
export type PromoPlacementParam = z.infer<typeof promoPlacementParamSchema>;
