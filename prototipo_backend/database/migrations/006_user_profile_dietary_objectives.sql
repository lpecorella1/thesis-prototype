BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'blood_type'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'dietary_preferences'
  ) THEN
    ALTER TABLE user_profiles
      RENAME COLUMN blood_type TO dietary_preferences;
  END IF;
END $$;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS dietary_preferences TEXT,
  ADD COLUMN IF NOT EXISTS primary_objective VARCHAR(80),
  ADD COLUMN IF NOT EXISTS secondary_objective VARCHAR(80),
  ADD COLUMN IF NOT EXISTS health_focus VARCHAR(80);

ALTER TABLE user_profiles
  ALTER COLUMN dietary_preferences TYPE TEXT;

COMMIT;
