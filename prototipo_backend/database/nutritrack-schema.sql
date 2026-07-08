BEGIN;

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    account_status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_email_format_chk CHECK (POSITION('@' IN email) > 1)
);

CREATE TABLE user_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(150),
    age INTEGER,
    gender VARCHAR(30),
    height_cm NUMERIC(5,2),
    current_weight_kg NUMERIC(5,2),
    target_weight_kg NUMERIC(5,2),
    activity_level VARCHAR(50),
    diet_type VARCHAR(50),
    allergies TEXT,
    medications TEXT,
    medical_conditions TEXT,
    blood_type VARCHAR(10),
    daily_calories_goal INTEGER,
    daily_protein_goal INTEGER,
    daily_carbs_goal INTEGER,
    daily_fats_goal INTEGER,
    daily_water_goal INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_profiles_age_chk CHECK (age IS NULL OR age BETWEEN 0 AND 120),
    CONSTRAINT user_profiles_height_chk CHECK (height_cm IS NULL OR height_cm > 0),
    CONSTRAINT user_profiles_current_weight_chk CHECK (current_weight_kg IS NULL OR current_weight_kg > 0),
    CONSTRAINT user_profiles_target_weight_chk CHECK (target_weight_kg IS NULL OR target_weight_kg > 0),
    CONSTRAINT user_profiles_calories_goal_chk CHECK (daily_calories_goal IS NULL OR daily_calories_goal >= 0),
    CONSTRAINT user_profiles_protein_goal_chk CHECK (daily_protein_goal IS NULL OR daily_protein_goal >= 0),
    CONSTRAINT user_profiles_carbs_goal_chk CHECK (daily_carbs_goal IS NULL OR daily_carbs_goal >= 0),
    CONSTRAINT user_profiles_fats_goal_chk CHECK (daily_fats_goal IS NULL OR daily_fats_goal >= 0),
    CONSTRAINT user_profiles_water_goal_chk CHECK (daily_water_goal IS NULL OR daily_water_goal >= 0)
);

CREATE TABLE recipes (
    id BIGSERIAL PRIMARY KEY,
    created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    calories NUMERIC(8,2),
    protein_g NUMERIC(8,2),
    carbs_g NUMERIC(8,2),
    fats_g NUMERIC(8,2),
    duration_minutes INTEGER,
    servings INTEGER,
    difficulty_level VARCHAR(30),
    diet_type VARCHAR(50),
    meal_type VARCHAR(50),
    ingredients_text TEXT NOT NULL,
    instructions_text TEXT NOT NULL,
    recipe_source_type VARCHAR(30) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT recipes_calories_chk CHECK (calories IS NULL OR calories >= 0),
    CONSTRAINT recipes_protein_chk CHECK (protein_g IS NULL OR protein_g >= 0),
    CONSTRAINT recipes_carbs_chk CHECK (carbs_g IS NULL OR carbs_g >= 0),
    CONSTRAINT recipes_fats_chk CHECK (fats_g IS NULL OR fats_g >= 0),
    CONSTRAINT recipes_duration_chk CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    CONSTRAINT recipes_servings_chk CHECK (servings IS NULL OR servings > 0)
);

CREATE TABLE nutrition_meals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id BIGINT REFERENCES recipes(id) ON DELETE SET NULL,
    meal_name VARCHAR(255) NOT NULL,
    meal_type VARCHAR(50),
    consumed_at TIMESTAMPTZ NOT NULL,
    calories NUMERIC(8,2) NOT NULL DEFAULT 0,
    protein_g NUMERIC(8,2) NOT NULL DEFAULT 0,
    carbs_g NUMERIC(8,2) NOT NULL DEFAULT 0,
    fats_g NUMERIC(8,2) NOT NULL DEFAULT 0,
    nutrition_source VARCHAR(100),
    source_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT nutrition_meals_calories_chk CHECK (calories >= 0),
    CONSTRAINT nutrition_meals_protein_chk CHECK (protein_g >= 0),
    CONSTRAINT nutrition_meals_carbs_chk CHECK (carbs_g >= 0),
    CONSTRAINT nutrition_meals_fats_chk CHECK (fats_g >= 0)
);

CREATE TABLE grocery_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity_label VARCHAR(100),
    category VARCHAR(100),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    linked_recipe_id BIGINT REFERENCES recipes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pantry_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity_label VARCHAR(100),
    category VARCHAR(100),
    expires_on DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE saved_recipes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT saved_recipes_user_recipe_uniq UNIQUE (user_id, recipe_id)
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_recipes_created_by_user_id ON recipes(created_by_user_id);
CREATE INDEX idx_recipes_meal_type ON recipes(meal_type);
CREATE INDEX idx_recipes_diet_type ON recipes(diet_type);
CREATE INDEX idx_nutrition_meals_user_id ON nutrition_meals(user_id);
CREATE INDEX idx_nutrition_meals_recipe_id ON nutrition_meals(recipe_id);
CREATE INDEX idx_nutrition_meals_consumed_at ON nutrition_meals(consumed_at);
CREATE INDEX idx_grocery_items_user_id ON grocery_items(user_id);
CREATE INDEX idx_grocery_items_completed ON grocery_items(user_id, is_completed);
CREATE INDEX idx_pantry_items_user_id ON pantry_items(user_id);
CREATE INDEX idx_pantry_items_expires_on ON pantry_items(user_id, expires_on);
CREATE INDEX idx_saved_recipes_user_id ON saved_recipes(user_id);
CREATE INDEX idx_saved_recipes_recipe_id ON saved_recipes(recipe_id);

COMMIT;
