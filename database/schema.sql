-- Local PostgreSQL schema for Job Hunt Dashboard
-- Apply with: psql "$DATABASE_URL" -f database/schema.sql

CREATE TABLE IF NOT EXISTS jobs (
  id text PRIMARY KEY,
  title text NOT NULL,
  company text NOT NULL,
  location text,
  url text,
  salary text,
  remote boolean DEFAULT false,
  seniority text,
  role_type text,
  application_type text,
  freshness text,
  description text,
  source text,
  status text,
  suitability integer,
  posted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  career_page_url text,
  red_flags jsonb DEFAULT '[]'::jsonb,
  research_status text DEFAULT 'pending',
  researched_at timestamptz,
  applied_at timestamptz,
  interview_date timestamptz,
  outcome_at timestamptz,
  outcome_notes text
);

ALTER TABLE jobs
  ALTER COLUMN remote SET DEFAULT false,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN red_flags SET DEFAULT '[]'::jsonb,
  ALTER COLUMN research_status SET DEFAULT 'pending';

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS career_page_url text,
  ADD COLUMN IF NOT EXISTS red_flags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS research_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS researched_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_date timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_notes text,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS suitability integer,
  ADD COLUMN IF NOT EXISTS role_type text,
  ADD COLUMN IF NOT EXISTS application_type text,
  ADD COLUMN IF NOT EXISTS freshness text,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS remote boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS salary text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS company text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_seniority_check'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_seniority_check
      CHECK (seniority IN ('junior', 'mid', 'senior', 'lead') OR seniority IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_role_type_check'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_role_type_check
      CHECK (role_type IN ('ux', 'product') OR role_type IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_application_type_check'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_application_type_check
      CHECK (application_type IN ('direct', 'recruiter') OR application_type IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_freshness_check'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_freshness_check
      CHECK (freshness IN ('fresh', 'recent', 'stale', 'unknown') OR freshness IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_status_check'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
      CHECK (status IN ('new', 'interested', 'applied', 'awaiting', 'interview', 'offer', 'rejected', 'ghosted') OR status IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_suitability_check'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_suitability_check
      CHECK (suitability >= 0 AND suitability <= 25);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_research_status_check'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_research_status_check
      CHECK (research_status IN ('pending', 'researching', 'complete', 'skipped', 'failed') OR research_status IS NULL);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_suitability ON jobs(suitability DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_research_status ON jobs(research_status);
CREATE INDEX IF NOT EXISTS idx_jobs_applied_at ON jobs(applied_at);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_updated_at ON jobs;
CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION auto_ghost_jobs()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  ghosted_count integer;
BEGIN
  UPDATE jobs
  SET
    status = 'ghosted',
    outcome_at = now(),
    outcome_notes = COALESCE(outcome_notes || E'\n', '') || 'Auto-ghosted after 30 days no response on ' || now()::date
  WHERE status = 'awaiting'
    AND applied_at < now() - interval '30 days';

  GET DIAGNOSTICS ghosted_count = ROW_COUNT;
  RETURN ghosted_count;
END;
$$;
