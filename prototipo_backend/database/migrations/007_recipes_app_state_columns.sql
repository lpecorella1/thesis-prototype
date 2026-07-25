BEGIN;

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS app_recipe_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature VARCHAR(255),
  ADD COLUMN IF NOT EXISTS recipe_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

DROP INDEX IF EXISTS idx_recipes_app_recipe_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_app_recipe_id
  ON recipes(created_by_user_id, app_recipe_id)
  WHERE app_recipe_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recipes_created_by_generated_at
  ON recipes(created_by_user_id, generated_at DESC, created_at DESC);

COMMIT;
