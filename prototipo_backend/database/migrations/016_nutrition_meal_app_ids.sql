ALTER TABLE nutrition_meals
    ADD COLUMN IF NOT EXISTS app_meal_id VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_meals_user_app_meal_id
    ON nutrition_meals(user_id, app_meal_id)
    WHERE app_meal_id IS NOT NULL;
