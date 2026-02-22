-- Migration: Add gym_campaigns table for launch interstitial ads
-- Used by LaunchAdView.swift in the iOS app

CREATE TABLE IF NOT EXISTS "gym_campaigns" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gym_id" varchar REFERENCES "gyms"("id") ON DELETE CASCADE,
  "gym_name" varchar(200) NOT NULL,
  "logo_url" text,
  "offer_text" text NOT NULL,
  "cta_label" varchar(100) NOT NULL DEFAULT 'Läs mer',
  "cta_url" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "starts_at" timestamp NOT NULL DEFAULT now(),
  "ends_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_gym_campaigns_active"
  ON "gym_campaigns" ("is_active", "starts_at", "ends_at");
