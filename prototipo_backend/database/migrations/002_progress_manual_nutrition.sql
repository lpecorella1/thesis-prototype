BEGIN;

ALTER TABLE progress_logs
    ADD COLUMN IF NOT EXISTS intake_calories INTEGER,
    ADD COLUMN IF NOT EXISTS protein_g NUMERIC(8,2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'progress_logs_intake_calories_chk'
    ) THEN
        ALTER TABLE progress_logs
            ADD CONSTRAINT progress_logs_intake_calories_chk
            CHECK (intake_calories IS NULL OR intake_calories >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'progress_logs_protein_chk'
    ) THEN
        ALTER TABLE progress_logs
            ADD CONSTRAINT progress_logs_protein_chk
            CHECK (protein_g IS NULL OR protein_g >= 0);
    END IF;
END $$;

COMMIT;
