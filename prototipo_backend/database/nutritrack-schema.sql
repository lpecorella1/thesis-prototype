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

CREATE TABLE progress_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    weight_kg NUMERIC(5,2),
    water_glasses INTEGER,
    steps INTEGER,
    burned_calories INTEGER,
    sleep_hours NUMERIC(4,2),
    note TEXT,
    source_type VARCHAR(30) NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT progress_logs_user_date_uniq UNIQUE (user_id, log_date),
    CONSTRAINT progress_logs_weight_chk CHECK (weight_kg IS NULL OR weight_kg > 0),
    CONSTRAINT progress_logs_water_chk CHECK (water_glasses IS NULL OR water_glasses >= 0),
    CONSTRAINT progress_logs_steps_chk CHECK (steps IS NULL OR steps >= 0),
    CONSTRAINT progress_logs_burned_calories_chk CHECK (burned_calories IS NULL OR burned_calories >= 0),
    CONSTRAINT progress_logs_sleep_chk CHECK (sleep_hours IS NULL OR sleep_hours >= 0)
);

CREATE TABLE saved_recipes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT saved_recipes_user_recipe_uniq UNIQUE (user_id, recipe_id)
);

CREATE TABLE device_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL,
    provider_key VARCHAR(50) NOT NULL,
    external_account_id VARCHAR(255),
    connection_status VARCHAR(30) NOT NULL DEFAULT 'configured',
    is_mock BOOLEAN NOT NULL DEFAULT TRUE,
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    last_sync_attempt_at TIMESTAMPTZ,
    last_successful_sync_at TIMESTAMPTZ,
    last_error_code VARCHAR(100),
    last_error_message TEXT,
    granted_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT device_connections_user_provider_uniq UNIQUE (user_id, provider_key),
    CONSTRAINT device_connections_status_chk CHECK (
        connection_status IN ('configured', 'pending', 'connected', 'token_expired', 'error', 'revoked', 'disconnected')
    )
);

CREATE TABLE device_sync_runs (
    id BIGSERIAL PRIMARY KEY,
    device_connection_id BIGINT NOT NULL REFERENCES device_connections(id) ON DELETE CASCADE,
    sync_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sync_finished_at TIMESTAMPTZ,
    sync_status VARCHAR(30) NOT NULL DEFAULT 'running',
    imported_records_count INTEGER NOT NULL DEFAULT 0,
    payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_code VARCHAR(100),
    error_message TEXT,
    CONSTRAINT device_sync_runs_status_chk CHECK (
        sync_status IN ('running', 'success', 'partial_success', 'failed')
    ),
    CONSTRAINT device_sync_runs_imported_records_chk CHECK (imported_records_count >= 0)
);

CREATE TABLE device_measurements (
    id BIGSERIAL PRIMARY KEY,
    device_connection_id BIGINT NOT NULL REFERENCES device_connections(id) ON DELETE CASCADE,
    sync_run_id BIGINT REFERENCES device_sync_runs(id) ON DELETE SET NULL,
    measurement_type VARCHAR(50) NOT NULL,
    measured_at TIMESTAMPTZ NOT NULL,
    numeric_value NUMERIC(10,2),
    text_value TEXT,
    unit VARCHAR(20),
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT device_measurements_value_chk CHECK (
        numeric_value IS NOT NULL OR text_value IS NOT NULL
    )
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
CREATE INDEX idx_progress_logs_user_date ON progress_logs(user_id, log_date DESC);
CREATE INDEX idx_saved_recipes_user_id ON saved_recipes(user_id);
CREATE INDEX idx_saved_recipes_recipe_id ON saved_recipes(recipe_id);
CREATE INDEX idx_device_connections_user_id ON device_connections(user_id);
CREATE INDEX idx_device_connections_status ON device_connections(user_id, connection_status);
CREATE INDEX idx_device_sync_runs_connection_id ON device_sync_runs(device_connection_id, sync_started_at DESC);
CREATE INDEX idx_device_measurements_connection_id ON device_measurements(device_connection_id, measured_at DESC);
CREATE INDEX idx_device_measurements_type ON device_measurements(device_connection_id, measurement_type, measured_at DESC);

COMMIT;
