BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_entry_mode_t') THEN
        CREATE TYPE user_entry_mode_t AS ENUM (
            'manual',
            'ai_assisted',
            'external_lookup',
            'imported',
            'system_generated'
        );
    END IF;
END
$$;

ALTER TABLE nutrition_meals
    ADD COLUMN IF NOT EXISTS entry_mode user_entry_mode_t NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS entry_method VARCHAR(100);

ALTER TABLE grocery_items
    ADD COLUMN IF NOT EXISTS entry_mode user_entry_mode_t NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS entry_method VARCHAR(100);

ALTER TABLE pantry_items
    ADD COLUMN IF NOT EXISTS entry_mode user_entry_mode_t NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS entry_method VARCHAR(100);

UPDATE nutrition_meals
SET
    entry_mode = CASE
        WHEN LOWER(COALESCE(nutrition_source, '')) LIKE '%openfoodfacts%'
            THEN 'external_lookup'::user_entry_mode_t
        WHEN LOWER(COALESCE(nutrition_source, '')) LIKE '%ai%'
            OR LOWER(COALESCE(nutrition_source, '')) LIKE '%analysis%'
            OR LOWER(COALESCE(nutrition_source, '')) LIKE '%fallback%'
            OR LOWER(COALESCE(nutrition_source, '')) LIKE '%stima%'
            THEN 'ai_assisted'::user_entry_mode_t
        WHEN LOWER(COALESCE(nutrition_source, '')) LIKE '%recipes%'
            THEN 'system_generated'::user_entry_mode_t
        WHEN LOWER(COALESCE(nutrition_source, '')) LIKE '%import%'
            THEN 'imported'::user_entry_mode_t
        ELSE 'manual'::user_entry_mode_t
    END,
    entry_method = CASE
        WHEN LOWER(COALESCE(nutrition_source, '')) LIKE '%openfoodfacts%'
            THEN 'barcode-openfoodfacts'
        WHEN LOWER(COALESCE(nutrition_source, '')) LIKE '%analysis%'
            OR LOWER(COALESCE(nutrition_source, '')) LIKE '%ai%'
            OR LOWER(COALESCE(nutrition_source, '')) LIKE '%fallback%'
            OR LOWER(COALESCE(nutrition_source, '')) LIKE '%stima%'
            THEN 'ai-meal-description-analysis'
        WHEN LOWER(COALESCE(nutrition_source, '')) LIKE '%recipes%'
            THEN 'recipe-application'
        ELSE 'manual-meal-form'
    END
WHERE entry_method IS NULL;

UPDATE grocery_items
SET
    entry_mode = CASE
        WHEN LOWER(COALESCE(source, '')) LIKE '%openfoodfacts%'
            OR LOWER(COALESCE(source, '')) LIKE '%barcode%'
            THEN 'external_lookup'::user_entry_mode_t
        WHEN LOWER(COALESCE(source, '')) LIKE '%ai%'
            THEN 'ai_assisted'::user_entry_mode_t
        WHEN LOWER(COALESCE(source, '')) LIKE '%import%'
            THEN 'imported'::user_entry_mode_t
        ELSE 'manual'::user_entry_mode_t
    END,
    entry_method = CASE
        WHEN LOWER(COALESCE(source, '')) LIKE '%openfoodfacts%'
            OR LOWER(COALESCE(source, '')) LIKE '%barcode%'
            THEN 'barcode-openfoodfacts'
        WHEN LOWER(COALESCE(source, '')) LIKE '%ai-generated%'
            THEN 'ai-generated-list'
        WHEN LOWER(COALESCE(source, '')) LIKE '%ai-image%'
            THEN 'ai-image-import'
        ELSE 'manual-grocery-form'
    END
WHERE entry_method IS NULL;

UPDATE pantry_items
SET
    entry_mode = CASE
        WHEN LOWER(COALESCE(source, '')) LIKE '%openfoodfacts%'
            OR LOWER(COALESCE(source, '')) LIKE '%barcode%'
            THEN 'external_lookup'::user_entry_mode_t
        WHEN LOWER(COALESCE(source, '')) LIKE '%ai%'
            THEN 'ai_assisted'::user_entry_mode_t
        WHEN LOWER(COALESCE(source, '')) LIKE '%import%'
            THEN 'imported'::user_entry_mode_t
        ELSE 'manual'::user_entry_mode_t
    END,
    entry_method = CASE
        WHEN LOWER(COALESCE(source, '')) LIKE '%openfoodfacts%'
            OR LOWER(COALESCE(source, '')) LIKE '%barcode%'
            THEN 'barcode-openfoodfacts'
        WHEN LOWER(COALESCE(source, '')) LIKE '%ai-generated%'
            THEN 'ai-generated-list'
        WHEN LOWER(COALESCE(source, '')) LIKE '%ai-image%'
            THEN 'ai-image-import'
        ELSE 'manual-pantry-form'
    END
WHERE entry_method IS NULL;

CREATE INDEX IF NOT EXISTS idx_nutrition_meals_entry_mode
    ON nutrition_meals(user_id, entry_mode, consumed_at DESC);

CREATE INDEX IF NOT EXISTS idx_grocery_items_entry_mode
    ON grocery_items(user_id, entry_mode, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pantry_items_entry_mode
    ON pantry_items(user_id, entry_mode, created_at DESC);

CREATE OR REPLACE VIEW user_entry_mode_daily_summary AS
SELECT
    user_id,
    activity_date,
    domain,
    entry_mode,
    COUNT(*) AS entry_count
FROM (
    SELECT
        user_id,
        consumed_at::date AS activity_date,
        'nutrition_meal'::text AS domain,
        entry_mode
    FROM nutrition_meals
    UNION ALL
    SELECT
        user_id,
        created_at::date AS activity_date,
        'grocery_item'::text AS domain,
        entry_mode
    FROM grocery_items
    UNION ALL
    SELECT
        user_id,
        created_at::date AS activity_date,
        'pantry_item'::text AS domain,
        entry_mode
    FROM pantry_items
) activity_entries
GROUP BY user_id, activity_date, domain, entry_mode;

COMMIT;
