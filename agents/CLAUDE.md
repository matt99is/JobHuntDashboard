# Job Hunt Dashboard - Claude Code Instructions

> **Start here.** This is the main entry point for all job search operations.

## Quick Commands

| Command | Action |
|---------|--------|
| "run job search" | Full workflow: scrape → research → sync |
| "check my email for jobs" | LinkedIn email scan only |
| "sync jobs" | Run `npm run sync` |

---

## Full Workflow: "run job search"

### Architecture

```
Phase 1: SCRAPE ──→ Phase 2: FILTER ──→ Phase 3: RESEARCH ──→ Phase 4: SYNC
   [Haiku x5]          [Opus]             [Haiku xN]           [Opus]
   (parallel)          (quick)            (parallel)
```

**Token optimization:** Haiku handles all heavy lifting (scraping, research). Opus only orchestrates and filters.

---

### Step 1: Scrape Sources (Parallel Haiku Agents)

**CRITICAL: Launch ALL scraper agents in a SINGLE message with multiple Task calls.**

Use `model: "haiku"` and `subagent_type: "general-purpose"` for each:

```
┌────────────────────────────────────────────────────────────────────┐
│ Task 1: LinkedIn/Gmail Agent                                       │
├────────────────────────────────────────────────────────────────────┤
│ Search Gmail: from:linkedin subject:(job OR opportunity) newer_than:7d
│ Extract job URLs (linkedin.com/jobs/view/XXXXX)                    │
│ Fetch each URL, extract: title, company, location, salary, desc    │
│ Score each job using criteria below                                │
│ Return JSON array of jobs                                          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ Task 2: uiuxjobsboard Agent                                        │
├────────────────────────────────────────────────────────────────────┤
│ Fetch: https://uiuxjobsboard.com/design-jobs/remote-united-kingdom │
│ Extract all job listings                                           │
│ Score each job using criteria below                                │
│ Return JSON array of jobs                                          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ Task 3: WorkInStartups Agent                                       │
├────────────────────────────────────────────────────────────────────┤
│ Fetch: https://workinstartups.com/job-board/jobs/designers         │
│ Filter for Manchester/Remote UK only                               │
│ Score each job using criteria below                                │
│ Return JSON array of jobs                                          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ Task 4: Indeed Agent (skip if 403)                                 │
├────────────────────────────────────────────────────────────────────┤
│ Fetch: https://uk.indeed.com/jobs?q=ux+designer&l=manchester&fromage=14
│ Score each job using criteria below                                │
│ Return JSON array of jobs                                          │
└────────────────────────────────────────────────────────────────────┘
```

**Each agent prompt must include:**
1. The source URL(s) to scrape
2. The scoring criteria (copy from below)
3. The exclusion rules (copy from below)
4. Instructions to return a JSON array

**Example Task call:**
```
Task(
  description: "Scrape uiuxjobsboard",
  model: "haiku",
  subagent_type: "general-purpose",
  prompt: "Scrape UX jobs from https://uiuxjobsboard.com/design-jobs/remote-united-kingdom

  For each job extract: title, company, location, salary, description, posted date, URL

  EXCLUDE if: contract/freelance, gambling company, >30 days old, not UK

  SCORE (0-25):
  - e-commerce, retail, conversion, figma: +3 each
  - b2b, saas, design system: +2 each
  - Senior/Lead UX: +3, Mid UX: +2
  - Remote: +2
  - £80k+: +3, £65-79k: +2, £50-64k: +1

  Return JSON array with structure:
  [{title, company, location, source: 'uiuxjobsboard', type: 'direct', url, remote, salary, seniority, roleType, freshness, description, suitability, postedAt}]"
)
```

---

### Step 2: Collect & Dedupe (Opus)

After all scraper agents complete:

1. Collect JSON results from each agent
2. **OVERWRITE** `candidates/{source}.json` (fresh data each search)
3. Dedupe by company+title (keep highest score)
4. **Check Supabase** for existing jobs - exclude from research/summary
5. Filter: keep only NEW jobs with `suitability >= 15` for research

---

### Step 3: Research Companies (Parallel Haiku Agents)

**Before researching, check which jobs are NEW:**
```bash
# Query Supabase for existing company+title combinations
# Only research jobs that don't already exist in the database
```

**Launch ALL research agents in a SINGLE message.**

For each NEW job with `suitability >= 15` (skip recruiter placeholders):

```
Task(
  description: "Research {company}",
  model: "haiku",
  subagent_type: "general-purpose",
  prompt: "Research {company} for '{title}' role.

  1. Find careers page: WebSearch '{company} careers'
  2. Check red flags (only flag if verified):
     - Layoffs 2025 (>10% affected)
     - Glassdoor <3.5 (only if >20 reviews, patterns not individuals)
     - Financial issues (failed funding, runway)
     - High design turnover

  Return JSON:
  {career_page_url: '...' or null, red_flags: [{type, severity, summary, source}]}"
)
```

---

### Step 4: Update & Sync (Opus)

1. Add `directUrl` and `redFlags` to each job in `candidates/*.json`
2. Run: `npm run sync`

---

### Step 5: Report Summary

**IMPORTANT: Only report NEW jobs that were actually synced. Do NOT include:**
- Jobs already in the database (any status)
- Jobs that were skipped as duplicates

```
Job Search Complete

Sources: LinkedIn (3 new), uiuxjobsboard (2 new), WorkInStartups (0)
Researched: 5 companies, 1 red flag found
Synced: 5 new jobs

NEW opportunities:
1. Company - Role (score) - Location - Flags
```

---

## Scoring & Exclusion Rules

### Exclude if ANY match:
- Not Manchester / Remote UK / Overseas-with-UK-remote
- Contract / freelance
- Gambling (Bet365, Flutter, Entain)
- >30 days old
- Senior Product Designer
- Junior UX under £50k

### Scoring (0-25):
| Factor | Points |
|--------|--------|
| e-commerce, retail, user research, conversion, figma | +3 each |
| b2b, saas, prototyping, design system | +2 each |
| Senior/Lead UX | +3 |
| Mid UX | +2 |
| Remote | +2 |
| £80k+ | +3 |
| £65-79k | +2 |
| £50-64k | +1 |
| Recruiter InMail | +3 |
| <2 weeks old | +2 |

---

## Output Format

All sources use this JSON structure in `candidates/{source}.json`:

```json
[{
  "title": "UX Designer",
  "company": "Acme Corp",
  "location": "Manchester",
  "source": "LinkedIn",
  "type": "direct|recruiter",
  "url": "https://...",
  "remote": false,
  "salary": "50k-65k",
  "seniority": "mid|senior|lead|junior",
  "roleType": "ux|product",
  "freshness": "fresh|recent|stale",
  "description": "Brief role summary",
  "suitability": 18,
  "postedAt": "2026-01-01T00:00:00Z",
  "directUrl": "https://company.com/careers",
  "redFlags": []
}]
```

---

## Red Flag Types

| Type | Severity | Trigger |
|------|----------|---------|
| `layoffs` | high | >10% workforce in 12 months |
| `glassdoor_low` | medium | <3.5 rating AND >20 reviews |
| `financial` | high | Failed funding, runway issues |
| `turnover` | medium | Design team churn |

**Glassdoor rules:** Patterns > individuals, industry context matters, ignore <20 reviews.

---

## File Structure

```
├── agents/CLAUDE.md      # This file - main instructions
├── candidates/           # Scraped job data (per source)
├── scripts/
│   ├── sync-jobs.js      # Merge, dedupe, insert to Supabase
│   └── update-research.js # Update single job research
├── src/                  # React dashboard
└── supabase-schema.sql   # Database schema
```

## NPM Scripts

```bash
npm run dev      # Start dashboard localhost:5173
npm run sync     # Sync candidates to Supabase
npm run build    # Production build
```
