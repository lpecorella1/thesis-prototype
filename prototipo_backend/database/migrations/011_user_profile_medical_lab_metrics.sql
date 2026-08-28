BEGIN;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS medical_lab_metrics JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
