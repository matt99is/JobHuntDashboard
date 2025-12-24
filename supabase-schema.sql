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
  status text check (status in ('new', 'interested', 'applied', 'rejected')),
  suitability integer check (suitability >= 0 and suitability <= 25),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index for common queries
create index idx_jobs_status on jobs(status);
create index idx_jobs_suitability on jobs(suitability desc);

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
