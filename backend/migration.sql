-- V4 Migration (additive / safe)
-- Backend language: English. Localization is handled in UI.

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Per-user time model (user-adjustable defaults)
CREATE TABLE IF NOT EXISTS user_time_model (
  user_id TEXT PRIMARY KEY,
  work_seconds_per_10_reps INT NOT NULL DEFAULT 30,
  rest_between_sets_seconds INT NOT NULL DEFAULT 90,
  rest_between_exercises_seconds INT NOT NULL DEFAULT 120,
  warmup_minutes_default INT NOT NULL DEFAULT 8,
  cooldown_minutes_default INT NOT NULL DEFAULT 5,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_time_model_work CHECK (work_seconds_per_10_reps BETWEEN 10 AND 120),
  CONSTRAINT chk_time_model_rest_sets CHECK (rest_between_sets_seconds BETWEEN 0 AND 600),
  CONSTRAINT chk_time_model_rest_ex CHECK (rest_between_exercises_seconds BETWEEN 0 AND 900),
  CONSTRAINT chk_time_model_warmup CHECK (warmup_minutes_default BETWEEN 0 AND 30),
  CONSTRAINT chk_time_model_cooldown CHECK (cooldown_minutes_default BETWEEN 0 AND 30)
);

-- 2) Canonical equipment key (keep existing name/name_en for UI)
ALTER TABLE equipment_catalog
  ADD COLUMN IF NOT EXISTS equipment_key VARCHAR(40);

CREATE UNIQUE INDEX IF NOT EXISTS ux_equipment_catalog_equipment_key
  ON equipment_catalog (equipment_key)
  WHERE equipment_key IS NOT NULL;

-- 3) Equipment aliases for robust matching (user input, imports, etc.)
CREATE TABLE IF NOT EXISTS equipment_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_key VARCHAR(40) NOT NULL,
  alias TEXT NOT NULL,
  alias_norm TEXT NOT NULL,
  lang VARCHAR(10) DEFAULT 'en',
  source VARCHAR(20) DEFAULT 'seed',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_equipment_aliases_norm
  ON equipment_aliases (alias_norm);

CREATE INDEX IF NOT EXISTS idx_equipment_aliases_trgm
  ON equipment_aliases USING GIN (alias_norm gin_trgm_ops);

-- 4) Exercise ID hardening (do not force NOT NULL yet; backfill first)
CREATE UNIQUE INDEX IF NOT EXISTS ux_exercises_exercise_id
  ON exercises (exercise_id)
  WHERE exercise_id IS NOT NULL;

-- 5) Exercise aliases for robust matching (optional with V4 IDs-only, but useful for admin/imports)
CREATE TABLE IF NOT EXISTS exercise_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id VARCHAR(40) NOT NULL,
  alias TEXT NOT NULL,
  alias_norm TEXT NOT NULL,
  lang VARCHAR(10) DEFAULT 'en',
  source VARCHAR(20) DEFAULT 'seed',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_exercise_aliases_norm
  ON exercise_aliases (alias_norm);

CREATE INDEX IF NOT EXISTS idx_exercise_aliases_trgm
  ON exercise_aliases USING GIN (alias_norm gin_trgm_ops);

-- 6) User equipment: store canonical equipment_key to avoid runtime fuzzy matching
ALTER TABLE user_equipment
  ADD COLUMN IF NOT EXISTS equipment_key VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_user_equipment_key
  ON user_equipment (user_id, gym_id, equipment_key);

-- 7) Optional: per-exercise min/max sets (used by deterministic time fitting)
CREATE TABLE IF NOT EXISTS exercise_caps (
  exercise_id VARCHAR(40) PRIMARY KEY,
  min_sets INT NOT NULL DEFAULT 1,
  max_sets INT NOT NULL DEFAULT 6,
  CONSTRAINT chk_caps_min CHECK (min_sets BETWEEN 0 AND 20),
  CONSTRAINT chk_caps_max CHECK (max_sets BETWEEN 1 AND 30),
  CONSTRAINT chk_caps_order CHECK (max_sets >= min_sets)
);

-- 8) Candidate pools (bucketed IDs) to keep LLM prompts short
CREATE TABLE IF NOT EXISTS candidate_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope VARCHAR(10) NOT NULL,           -- 'global' | 'gym' | 'user'
  user_id TEXT,
  gym_id TEXT,
  pool_type VARCHAR(30) NOT NULL,       -- 'hypertrophy'|'strength'|'sport_hockey'|...
  buckets JSONB NOT NULL,               -- {"main_push": [..], "core": [..]}
  hash VARCHAR(64) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_candidate_pools_lookup
  ON candidate_pools (scope, user_id, gym_id, pool_type);

-- End of V4 migration
