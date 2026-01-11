-- Jobs table
create table jobs (
  id text primary key,
  title text not null,
  company text not null,
  location text,
  url text,
  salary text,
  remote boolean default false,
  seniority text check (seniority in ('junior', 'mid', 'senior', 'lead')),
  role_type text check (role_type in ('ux', 'product')),
  application_type text check (application_type in ('direct', 'recruiter')),
  freshness text check (freshness in ('fresh', 'recent', 'stale', 'unknown')),
  description text,
  source text,
  status text check (status in ('new', 'interested', 'applied', 'awaiting', 'interview', 'offer', 'rejected', 'ghosted')),
  suitability integer check (suitability >= 0 and suitability <= 25),
  posted_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  -- Company research fields
  career_page_url text,
  red_flags jsonb default '[]',
  research_status text default 'pending' check (research_status in ('pending', 'researching', 'complete', 'skipped', 'failed')),
  researched_at timestamp with time zone,
  -- Application tracking fields
  applied_at timestamp with time zone,
  interview_date timestamp with time zone,
  outcome_at timestamp with time zone,
  outcome_notes text
);

-- Index for common queries
create index idx_jobs_status on jobs(status);
create index idx_jobs_suitability on jobs(suitability desc);
create index idx_jobs_research_status on jobs(research_status);
create index idx_jobs_applied_at on jobs(applied_at);

-- Updated at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger jobs_updated_at
  before update on jobs
  for each row
  execute function update_updated_at();

-- Disable RLS (public dashboard, no auth)
alter table jobs disable row level security;

-- Migration: Add research columns to existing table
-- Run these in Supabase SQL editor if table already exists:
/*
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS career_page_url text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS red_flags jsonb DEFAULT '[]';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS research_status text DEFAULT 'pending'
  CHECK (research_status IN ('pending', 'researching', 'complete', 'skipped', 'failed'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS researched_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_jobs_research_status ON jobs(research_status);

-- Set research_status for existing jobs based on suitability
UPDATE jobs SET research_status = CASE
  WHEN suitability >= 15 THEN 'pending'
  ELSE 'skipped'
END WHERE research_status IS NULL;
*/

-- Migration: Add application tracking columns
-- Run these in Supabase SQL editor:
/*
-- 1. Expand status constraint to include new statuses
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('new', 'interested', 'applied', 'awaiting', 'interview', 'offer', 'rejected', 'ghosted'));

-- 2. Add timeline tracking columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS applied_at timestamp with time zone;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS interview_date timestamp with time zone;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS outcome_at timestamp with time zone;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS outcome_notes text;

-- 3. Add index for auto-ghost queries
CREATE INDEX IF NOT EXISTS idx_jobs_applied_at ON jobs(applied_at);
*/
