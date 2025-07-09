-- Pathfinder Synthesis Enhancement Database Migration
-- This script implements all schema enhancements from SYNTHESIS_ENHANCEMENT_PLAN.md

-- Step 1: Core Schema Enhancements for Existing Tables

-- Enhance realms table with quality tracking and versioning
DO $$ 
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'realms' AND column_name = 'current_version') THEN
        ALTER TABLE realms ADD COLUMN current_version integer DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'realms' AND column_name = 'quality_score') THEN
        ALTER TABLE realms ADD COLUMN quality_score float;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'realms' AND column_name = 'last_synthesis_at') THEN
        ALTER TABLE realms ADD COLUMN last_synthesis_at timestamptz;
    END IF;
END $$;

-- Enhance reflections table with categorization and importance
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reflections' AND column_name = 'category') THEN
        ALTER TABLE reflections ADD COLUMN category text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reflections' AND column_name = 'importance_score') THEN
        ALTER TABLE reflections ADD COLUMN importance_score float DEFAULT 1.0 CHECK (importance_score >= 0 AND importance_score <= 5);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reflections' AND column_name = 'last_synthesized_at') THEN
        ALTER TABLE reflections ADD COLUMN last_synthesized_at timestamptz;
    END IF;
END $$;

-- Enhance texts table with processing metadata
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'texts' AND column_name = 'source_file_name') THEN
        ALTER TABLE texts ADD COLUMN source_file_name text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'texts' AND column_name = 'processing_metadata') THEN
        ALTER TABLE texts ADD COLUMN processing_metadata jsonb DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'texts' AND column_name = 'synthesis_history') THEN
        ALTER TABLE texts ADD COLUMN synthesis_history jsonb DEFAULT '[]';
    END IF;
END $$;

-- Step 2: Create New Tables for Enhanced Features

-- Prompt versioning and evolution tracking
CREATE TABLE IF NOT EXISTS prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid REFERENCES realms(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content text NOT NULL,
  synthesis_method text DEFAULT 'legacy' CHECK (synthesis_method IN ('qa_synthesis', 'text_integration', 'hybrid', 'advanced', 'legacy', 'manual')),
  quality_score float,
  effectiveness_metrics jsonb DEFAULT '{}',
  improvement_suggestions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Unified content sources for synthesis
CREATE TABLE IF NOT EXISTS content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid REFERENCES realms(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('reflection', 'text', 'conversation', 'document', 'structured')),
  title text,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  weight float DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 5),
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Advanced synthesis job tracking
CREATE TABLE IF NOT EXISTS synthesis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid REFERENCES realms(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  synthesis_type text CHECK (synthesis_type IN ('full', 'incremental', 'quality_improvement')),
  input_sources jsonb DEFAULT '[]',
  configuration jsonb DEFAULT '{}',
  result_prompt text,
  quality_analysis jsonb,
  processing_time_ms integer,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Conversation effectiveness tracking
CREATE TABLE IF NOT EXISTS conversation_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
  realm_id uuid REFERENCES realms(id) ON DELETE CASCADE,
  prompt_version integer,
  user_satisfaction_score integer CHECK (user_satisfaction_score >= 1 AND user_satisfaction_score <= 5),
  response_relevance_score float CHECK (response_relevance_score >= 0 AND response_relevance_score <= 1),
  context_usage_analysis jsonb DEFAULT '{}',
  improvement_suggestions jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Synthesis queue for batch processing (smart synthesis management)
CREATE TABLE IF NOT EXISTS synthesis_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid REFERENCES realms(id) ON DELETE CASCADE,
  content_source_id uuid REFERENCES content_sources(id) ON DELETE CASCADE,
  queued_at timestamptz DEFAULT now(),
  processed boolean DEFAULT false,
  processed_at timestamptz
);

-- Step 3: Create Performance Indexes

-- Content sources indexes
CREATE INDEX IF NOT EXISTS idx_content_sources_realm_type ON content_sources(realm_id, source_type);
CREATE INDEX IF NOT EXISTS idx_content_sources_weight ON content_sources(weight DESC);
CREATE INDEX IF NOT EXISTS idx_content_sources_created ON content_sources(created_at DESC);

-- Prompt versions indexes
CREATE INDEX IF NOT EXISTS idx_prompt_versions_realm_version ON prompt_versions(realm_id, version_number);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_quality ON prompt_versions(quality_score DESC);

-- Synthesis jobs indexes
CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_status ON synthesis_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_synthesis_jobs_realm ON synthesis_jobs(realm_id, created_at DESC);

-- Conversation metrics indexes
CREATE INDEX IF NOT EXISTS idx_conversation_metrics_realm ON conversation_metrics(realm_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_metrics_chat ON conversation_metrics(chat_id, created_at DESC);

-- Enhanced reflections indexes
CREATE INDEX IF NOT EXISTS idx_reflections_category ON reflections(realm_id, category);
CREATE INDEX IF NOT EXISTS idx_reflections_importance ON reflections(importance_score DESC);

-- Synthesis queue indexes
CREATE INDEX IF NOT EXISTS idx_synthesis_queue_realm_processed ON synthesis_queue(realm_id, processed);
CREATE INDEX IF NOT EXISTS idx_synthesis_queue_queued_at ON synthesis_queue(queued_at);

-- Step 4: Initialize Current Version for Existing Realms
UPDATE realms 
SET current_version = 1 
WHERE current_version IS NULL;

-- Step 5: Data Migration Notice
-- Note: After running this SQL migration, execute the Python data migration script:
-- python backend/utils/data_migration.py
-- This will migrate existing reflections and texts to the new content_sources structure

COMMIT; 