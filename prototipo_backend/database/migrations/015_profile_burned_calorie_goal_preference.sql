BEGIN;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS include_burned_calories_in_goal BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
