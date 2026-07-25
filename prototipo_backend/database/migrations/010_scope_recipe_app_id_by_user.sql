BEGIN;

DROP INDEX IF EXISTS idx_recipes_app_recipe_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recipes_app_recipe_id
  ON recipes(created_by_user_id, app_recipe_id)
  WHERE app_recipe_id IS NOT NULL;

COMMIT;
