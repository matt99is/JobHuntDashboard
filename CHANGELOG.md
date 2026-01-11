# Changelog

All notable changes to this project will be documented in this file.

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
