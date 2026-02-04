CREATE TABLE "affiliate_clicks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"promo_id" varchar NOT NULL,
	"clicked_url" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_catalog" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"category" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "equipment_catalog_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "exercise_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_session_id" varchar NOT NULL,
	"exercise_key" varchar(50) NOT NULL,
	"exercise_title" text NOT NULL,
	"exercise_order_index" integer NOT NULL,
	"set_number" integer NOT NULL,
	"weight" integer,
	"reps" integer,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"exercise_key" varchar(50) NOT NULL,
	"exercise_name" varchar(200) NOT NULL,
	"muscles" text[],
	"avg_weight" integer,
	"max_weight" integer,
	"last_weight" integer,
	"total_volume" integer DEFAULT 0,
	"total_sets" integer DEFAULT 0,
	"total_sessions" integer DEFAULT 0,
	"recent_weights" jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "exercise_stats_user_id_exercise_key_unique" UNIQUE("user_id","exercise_key")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" varchar(20),
	"name" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"description" text,
	"category" varchar(50) NOT NULL,
	"difficulty" varchar(20) NOT NULL,
	"primary_muscles" text[] NOT NULL,
	"secondary_muscles" text[],
	"required_equipment" text[] NOT NULL,
	"movement_pattern" varchar(50),
	"is_compound" boolean DEFAULT false NOT NULL,
	"youtube_url" text,
	"video_type" varchar(20),
	"instructions" text,
	"requires_1rm" boolean DEFAULT false,
	"good_for_beginners" boolean DEFAULT false,
	"core_engagement" boolean DEFAULT false,
	"gender_specialization" varchar(20),
	"categories" text[],
	"ai_search_terms" text[],
	"training_level_priority" text[],
	"equipment_mapping_tags" text[],
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "exercises_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "gym_programs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"gym_id" varchar NOT NULL,
	"program_data" jsonb NOT NULL,
	"template_snapshot" jsonb,
	"snapshot_created_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "gym_programs_user_id_gym_id_unique" UNIQUE("user_id","gym_id")
);
--> statement-breakpoint
CREATE TABLE "gyms" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar(200) NOT NULL,
	"location" varchar(300),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "health_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"platform" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"vital_user_id" varchar(200),
	"encrypted_access_token" text,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"disconnected_at" timestamp,
	"last_error" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "health_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"connection_id" varchar,
	"metric_type" varchar(50) NOT NULL,
	"value" integer NOT NULL,
	"unit" varchar(20) NOT NULL,
	"date" timestamp NOT NULL,
	"collected_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "health_metrics_user_id_metric_type_date_unique" UNIQUE("user_id","metric_type","date")
);
--> statement-breakpoint
CREATE TABLE "health_sync_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"connection_id" varchar,
	"platform" varchar(50) NOT NULL,
	"sync_type" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"metrics_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"payload_hash" varchar(64),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"push_enabled" boolean DEFAULT false NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"workout_reminders" boolean DEFAULT true NOT NULL,
	"motivational_quotes" boolean DEFAULT true NOT NULL,
	"affiliate_offers" boolean DEFAULT false NOT NULL,
	"push_token" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notification_schedule" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" varchar(50) NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp,
	"title" varchar(200),
	"body" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profile_training_tips" (
	"id" varchar PRIMARY KEY NOT NULL,
	"tip_text" text NOT NULL,
	"age_group" varchar(20) NOT NULL,
	"sport" varchar(100),
	"category" varchar(100) NOT NULL,
	"gender" varchar(10) NOT NULL,
	"training_level" varchar(50) NOT NULL,
	"affiliate_link" varchar(500),
	"word_count" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "program_template_exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar NOT NULL,
	"exercise_key" varchar(50) NOT NULL,
	"exercise_name" varchar(200) NOT NULL,
	"order_index" integer NOT NULL,
	"target_sets" integer NOT NULL,
	"target_reps" varchar(50) NOT NULL,
	"target_weight" integer,
	"required_equipment" text[],
	"muscles" text[],
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "program_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"template_name" varchar(100) NOT NULL,
	"muscle_focus" varchar(100),
	"day_of_week" integer,
	"estimated_duration_minutes" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promo_content" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) NOT NULL,
	"placement" varchar(50) NOT NULL,
	"title" varchar(200),
	"description" text,
	"cta_text" varchar(100),
	"cta_url" text,
	"partner_name" varchar(100),
	"image_url" text,
	"targeting_rules" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"frequency_cap_hours" integer DEFAULT 24,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promo_impressions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"promo_id" varchar NOT NULL,
	"placement" varchar(50) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_tips" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"workout_types" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"icon" varchar(10) NOT NULL,
	"related_promo_placement" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unmapped_exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ai_name" varchar(200) NOT NULL,
	"suggested_match" varchar(200),
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unmapped_exercises_ai_name_unique" UNIQUE("ai_name")
);
--> statement-breakpoint
CREATE TABLE "user_equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"gym_id" varchar NOT NULL,
	"equipment_type" varchar(100) NOT NULL,
	"equipment_name" varchar(200) NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_equipment_gym_id_equipment_name_unique" UNIQUE("gym_id","equipment_name")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"age" integer,
	"sex" varchar(20),
	"body_weight" integer,
	"height" integer,
	"body_fat_percent" integer,
	"muscle_mass_percent" integer,
	"one_rm_bench" integer,
	"one_rm_ohp" integer,
	"one_rm_deadlift" integer,
	"one_rm_squat" integer,
	"one_rm_latpull" integer,
	"motivation_type" varchar(50),
	"training_goals" varchar(50),
	"training_level" varchar(20),
	"specific_sport" varchar(100),
	"goal_strength" integer DEFAULT 50,
	"goal_volume" integer DEFAULT 50,
	"goal_endurance" integer DEFAULT 50,
	"goal_cardio" integer DEFAULT 50,
	"sessions_per_week" integer DEFAULT 3,
	"session_duration" integer DEFAULT 60,
	"rest_time" integer DEFAULT 60,
	"theme" varchar(20) DEFAULT 'main',
	"avatar_type" varchar(20) DEFAULT 'emoji',
	"avatar_emoji" varchar(10) DEFAULT '💪',
	"avatar_image_url" text,
	"avatar_config" jsonb,
	"onboarding_completed" boolean DEFAULT false,
	"apple_health_connected" boolean DEFAULT false,
	"equipment_registered" boolean DEFAULT false,
	"has_ai_program" boolean DEFAULT false,
	"ai_program_data" jsonb,
	"selected_gym_id" varchar,
	"last_completed_template_id" varchar,
	"last_session_type" varchar(10),
	"current_pass_number" integer DEFAULT 1,
	"program_generations_this_week" integer DEFAULT 0,
	"week_start_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"status" varchar(50) DEFAULT 'free' NOT NULL,
	"stripe_customer_id" varchar(200),
	"stripe_subscription_id" varchar(200),
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"template_id" varchar,
	"session_type" varchar(10) NOT NULL,
	"session_name" varchar(200),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"notes" text,
	"movergy_score" integer,
	"snapshot_data" jsonb
);
--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_promo_id_promo_content_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."promo_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_workout_session_id_workout_sessions_id_fk" FOREIGN KEY ("workout_session_id") REFERENCES "public"."workout_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_stats" ADD CONSTRAINT "exercise_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_programs" ADD CONSTRAINT "gym_programs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_programs" ADD CONSTRAINT "gym_programs_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gyms" ADD CONSTRAINT "gyms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_connections" ADD CONSTRAINT "health_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_metrics" ADD CONSTRAINT "health_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_metrics" ADD CONSTRAINT "health_metrics_connection_id_health_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."health_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_sync_logs" ADD CONSTRAINT "health_sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_sync_logs" ADD CONSTRAINT "health_sync_logs_connection_id_health_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."health_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_schedule" ADD CONSTRAINT "notification_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_template_exercises" ADD CONSTRAINT "program_template_exercises_template_id_program_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."program_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_templates" ADD CONSTRAINT "program_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_impressions" ADD CONSTRAINT "promo_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_impressions" ADD CONSTRAINT "promo_impressions_promo_id_promo_content_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."promo_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_equipment" ADD CONSTRAINT "user_equipment_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_selected_gym_id_gyms_id_fk" FOREIGN KEY ("selected_gym_id") REFERENCES "public"."gyms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_template_id_program_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."program_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "health_connections_user_id_idx" ON "health_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "health_connections_platform_idx" ON "health_connections" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "health_connections_status_idx" ON "health_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "health_connections_vital_user_id_idx" ON "health_connections" USING btree ("vital_user_id");--> statement-breakpoint
CREATE INDEX "health_metrics_user_metric_date_idx" ON "health_metrics" USING btree ("user_id","metric_type","date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "health_metrics_connection_collected_idx" ON "health_metrics" USING btree ("connection_id","collected_at");--> statement-breakpoint
CREATE INDEX "health_metrics_date_idx" ON "health_metrics" USING btree ("date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "health_sync_logs_user_id_idx" ON "health_sync_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "health_sync_logs_connection_id_idx" ON "health_sync_logs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "health_sync_logs_status_idx" ON "health_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "health_sync_logs_created_at_idx" ON "health_sync_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");