# Changelog

All notable changes to this project will be documented in this file.

## [1.0.1] - 2026-01-12

### Changed

- **Auto-Ghost System** - Migrated from GitHub Actions to Supabase pg_cron for better reliability
  - No more authentication issues with anon keys
  - Native database scheduling runs daily at 2 AM UTC
  - Removed `.github/workflows/auto-ghost.yml` workflow

### Security

- **Database Security** - Added `supabase-security-fix.sql` migration
  - Enabled Row Level Security (RLS) on jobs table with permissive policy
  - Fixed search_path on `auto_ghost_jobs()` and `update_updated_at()` functions
  - Resolves Supabase linter security warnings

### Documentation

- Updated README with pg_cron setup instructions
- Updated agents/CLAUDE.md to reflect pg_cron usage

## [1.0.0] - 2026-01-11

### Features

- **Job Search Automation** - Parallel Haiku agents scrape LinkedIn, uiuxjobsboard, WorkInStartups, Indeed
- **Smart Scoring** - Jobs ranked 0-25 based on role type, salary, remote status, tech stack
- **Company Research** - Red flag detection (layoffs, Glassdoor ratings, financial issues)
- **Recruiter Detection** - Flags jobs posted by recruitment agencies vs direct employers
- **Application Tracking** - Full pipeline: `new` → `awaiting` → `interview` → `offer/rejected/ghosted`
- **Auto-Ghost** - GitHub Actions marks applications as ghosted after 30 days no response
- **Timeline Tracking** - Records `applied_at`, `interview_date`, `outcome_at` timestamps
- **Status-Aware UI** - Action buttons change based on current application status

### Tech Stack

- React 18 + TypeScript + Tailwind CSS + Vite
- Supabase (PostgreSQL)
- Netlify hosting
- Claude Code with Haiku/Sonnet (no Opus)

### Database Schema

- `jobs` table with status workflow, research fields, and application tracking
- Soft delete pattern (rejected/ghosted hidden from main view)
- Indexes on status, suitability, applied_at

### Scripts

- `sync-jobs.js` - Merge, dedupe, upsert to Supabase
- `auto-ghost.js` - Mark stale applications as ghosted
- `update-research.js` - Update single job research data
