-- Add description field to realms table
-- Migration: Add realm description support for onboarding flow

DO $$ 
BEGIN
    -- Add description column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'realms' AND column_name = 'description') THEN
        ALTER TABLE realms ADD COLUMN description text;
        RAISE NOTICE 'Added description column to realms table';
    ELSE
        RAISE NOTICE 'Description column already exists in realms table';
    END IF;
END $$; 