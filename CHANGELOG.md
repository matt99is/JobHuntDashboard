# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-18

### Added

- **Token Optimization** - New scripts reduce AI token usage by ~80%
  - `scripts/filter-new.js` - Filters new jobs vs existing database (replaces Sonnet agent)
  - `scripts/merge-research.js` - Merges research results into candidates (replaces Sonnet agent)
  - Research queue system (`candidates/research-queue.json`) for targeted AI usage
  - Only company research (Phase 3) uses AI now - all other phases are scripts

- **API-Based Job Fetching** - Replaced web scraping with official APIs
  - `scripts/fetch-adzuna.js` - Adzuna API integration (UK job aggregator)
  - `scripts/fetch-reed.js` - Reed.co.uk API integration (pure UK jobs)
  - Full job descriptions, skills, and salary data (vs incomplete email summaries)
  - Built-in filtering and scoring (runs at fetch time, not research time)
  - Rate limiting for Reed API (1000 calls/day limit)

- **Comprehensive Documentation** - Every file heavily annotated for future developers
  - JSDoc-style headers explaining purpose, workflow position, inputs/outputs
  - Inline comments explaining "why" not just "what"
  - TODO comments marking missing features or refactoring opportunities
  - Maintenance notes in each script header

### Changed

- **Workflow Architecture** - 5 phases instead of 4
  - Phase 1: Fetch (npm scripts) - previously scraping with Haiku agents
  - Phase 2: Filter (npm script) - previously Sonnet agent
  - Phase 3: Research (Haiku agents) - unchanged, highest value AI usage
  - Phase 4: Merge (npm script) - previously Sonnet agent
  - Phase 5: Sync (npm script) - unchanged

- **Job Sources** - Now using Adzuna + Reed APIs instead of web scraping
  - More reliable (no HTML parsing breakage)
  - Better data quality (full descriptions, not summaries)
  - Faster execution (parallel API calls vs sequential scrapes)
  - Lower token usage (scoring in scripts, not AI)

- **Candidate File Structure** - New `research-queue.json` for targeted research
  - Only jobs with suitability >= 15 go to research queue
  - Expired jobs filtered out before sync
  - Direct URLs verified by AI, not guessed

### Performance

- **Token Reduction** - ~80% fewer tokens per job search
  - Before: ~10-20k tokens (Sonnet for filtering + merging + orchestration)
  - After: ~2-4k tokens (Haiku for research only)
  - Cost savings: ~$0.15 → ~$0.03 per job search

- **Execution Speed** - Faster due to API usage vs web scraping
  - Parallel API calls vs sequential scrapes
  - No browser rendering or JavaScript execution
  - Instant data retrieval vs page load times

### Documentation

- Updated `agents/CLAUDE.md` with new 5-phase workflow
- Updated `README.md` with token optimization details
- Added "Token Optimization Strategy" section explaining design decisions
- Updated NPM scripts tables in all documentation
- Updated file structure diagrams with new scripts

### Developer Experience

- All scripts follow same structure: config, helpers, main execution
- Error handling with clear messages and exit codes
- Console output with progress indicators and summaries
- Argument parsing for flexibility (e.g., `--results=file.json`)
- TODO comments for future improvements (grep for "TODO:")

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
