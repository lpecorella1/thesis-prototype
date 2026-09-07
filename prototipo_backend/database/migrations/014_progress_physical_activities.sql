BEGIN;

ALTER TABLE progress_logs
  ADD COLUMN IF NOT EXISTS physical_activities JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
