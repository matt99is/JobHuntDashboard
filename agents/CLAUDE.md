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

### Step 1: Scrape Sources (parallel where possible)

**LinkedIn (via Gmail)**
```
from:linkedin subject:(job OR opportunity OR role) newer_than:7d
```
- Read emails, extract job URLs (`linkedin.com/jobs/view/XXXXX`)
- Fetch each URL for details

**uiuxjobsboard**
- Fetch: `https://uiuxjobsboard.com/design-jobs/remote-united-kingdom`

**WorkInStartups**
- Fetch: `https://workinstartups.com/job-board/jobs/designers`
- Filter for Manchester/Remote UK

**Indeed** (skip if 403)
- `https://uk.indeed.com/jobs?q=ux+designer&l=manchester&fromage=14`

### Step 2: Score & Filter

**Exclude if ANY match:**
- Not Manchester / Remote UK / Overseas-with-UK-remote
- Contract / freelance
- Gambling (Bet365, Flutter, Entain)
- >30 days old
- Senior Product Designer
- Junior UX under £50k

**Scoring (0-25):**
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

### Step 3: Research Companies (suitability >= 15)

**Launch Haiku subagents IN PARALLEL** (single message, multiple Task calls):

```
Research {company} for "{title}".

1. Find careers page: Search "{company} careers"
2. Check red flags (only flag if verified):
   - Layoffs 2025 (>10% affected)
   - Glassdoor <3.5 (only if >20 reviews, look for patterns)
   - Financial issues (failed funding, runway)
   - High design turnover

Return JSON:
{"career_page_url": "..." or null, "red_flags": [{"type": "layoffs|glassdoor_low|financial|turnover", "severity": "high|medium|low", "summary": "...", "source": "..."}]}
```

**Skip research for:** Recruiter placeholders ("Client", "Confidential")

### Step 4: Update Candidates & Sync

Add to each researched job in `candidates/*.json`:
```json
{
  "directUrl": "https://company.com/careers",
  "redFlags": []
}
```

Then run: `npm run sync`

### Step 5: Report Summary

```
Job Search Complete

Sources: LinkedIn (3), uiuxjobsboard (2), WorkInStartups (0)
Researched: 5 companies, 1 red flag found
Synced: 5 new jobs

Top opportunities:
1. Company - Role (score) - Location
```

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
