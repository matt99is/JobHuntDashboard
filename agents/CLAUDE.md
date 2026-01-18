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
Phase 1: FETCH APIs ──→ Phase 2: FILTER ──→ Phase 3: RESEARCH ──→ Phase 4: MERGE ──→ Phase 5: SYNC
   [npm scripts]         [npm script]        [Haiku xN]           [npm script]       [npm script]
   (sequential)          (fast O(1))         (parallel)           (fast O(1))        (upsert)
```

**Data sources:** Adzuna API + Reed API provide complete job data (descriptions, skills, salary) for accurate scoring.
**Token optimization:** Only Haiku agents for research. All other phases are scripts (ZERO tokens). Do NOT use Opus for this project.

---

### Step 1: Fetch from APIs (Sequential npm scripts)

```bash
# 1. Fetch from Adzuna API (UK job aggregator)
npm run fetch:adzuna

# 2. Fetch from Reed API (Pure UK jobs)
npm run fetch:reed

# OR run both in one command:
npm run fetch:all
```

**What these scripts do:**
- **Adzuna**: Searches "ux designer manchester", "product designer manchester", "ux designer remote uk", "product designer remote uk"
- **Reed**: Same searches with 30-mile radius from Manchester + Remote UK
- **Automatic filtering**: Both scripts apply all exclusion rules and scoring
- **Rate limiting**: Reed includes 100ms delays between detail fetches (1000/day limit)
- **Output**: `candidates/adzuna.json` and `candidates/reed.json`

**Data quality:**
✅ Full job descriptions (not email summaries)
✅ Skills and requirements
✅ Actual salary ranges
✅ Posted dates for freshness checks
✅ Company names for recruiter detection

---

### Step 2: Filter New Jobs (npm script - ZERO tokens)

After API fetch completes, run the filter script to identify new jobs:

```bash
npm run filter:new
```

**What this script does:**
1. Loads `candidates/adzuna.json` and `candidates/reed.json`
2. Deduplicates across sources (keeps highest score)
3. Queries Supabase for existing jobs
4. Filters to only NEW jobs (not in database)
5. Filters to jobs needing research (`suitability >= 10`, not recruiters)
6. Outputs `candidates/research-queue.json`

**Output:** Console report showing:
- Total candidates vs new jobs
- How many need research vs auto-sync
- Top jobs to research

**No AI tokens used** - pure data processing with O(1) lookups.

---

### Step 3: Research Companies (Parallel Haiku Agents)

**Input:** `candidates/research-queue.json` (from Step 2)

**Launch ALL research agents in a SINGLE message** (use parallel Task calls).

For each job in the research queue:

```
Task(
  description: "Research {company}",
  model: "haiku",
  subagent_type: "general-purpose",
  prompt: "Research {company} for '{title}' role.

  1. Identify if company is a recruiter/intermediary:
     - Check if company is a recruitment agency, staffing firm, job board, or job aggregator
     - Check if they describe themselves as placing candidates or listing jobs for other companies
     - Look for phrases like "our client", "on behalf of" in job descriptions
     - Set is_recruiter: true/false

  2. Find the ACTUAL job listing URL and verify it's still active:
     - WebSearch '{company} {title} job' or '{company} careers {title}'
     - WebFetch the result to VERIFY it exists and contains the role
     - CHECK for expiration signals: "no longer accepting", "position filled",
       "this job is closed", 404, redirect to careers homepage
     - Set expired: true if job is no longer active
     - Only return URL if you confirm the page loads and shows an ACTIVE job
     - Return null if you can't find a verified direct link
     - DO NOT guess URLs like 'company.com/careers' - verify or return null

  3. Check red flags (only flag if verified):
     - Layoffs 2025 (>10% affected)
     - Glassdoor <3.5 (only if >20 reviews, patterns not individuals)
     - Financial issues (failed funding, runway)
     - High design turnover

  Return JSON:
  {is_recruiter: true/false, direct_job_url: '...' or null, expired: true/false, red_flags: [{type, severity, summary, source}]}"
)
```

---

### Step 4: Merge Research Results (npm script - ZERO tokens)

After research agents complete, collect results and merge them back:

```bash
npm run merge:research -- --results=research-results.json
```

**What this script does:**
1. Loads research results from file (or default location)
2. Updates `candidates/*.json` files with:
   - `directJobUrl` (verified URL or null)
   - `expired` (true/false)
   - `redFlags` array
   - `type` changed to "recruiter" if `is_recruiter: true`
3. Saves updated candidate files

**Input format** (research-results.json):
```json
[{
  "id": "adzuna-acme-corp-ux-designer",
  "company": "Acme Corp",
  "is_recruiter": false,
  "direct_job_url": "https://acme.com/careers/123",
  "expired": false,
  "red_flags": [...]
}]
```

**No AI tokens used** - pure data merging with ID lookups.

---

### Step 5: Sync to Database (npm script - ZERO tokens)

```bash
npm run sync
```

**What this script does:**
1. Loads all `candidates/*.json` files
2. Filters out expired jobs (don't sync dead listings)
3. Checks database for existing jobs
4. Inserts only NEW jobs
5. Marks old jobs as stale (>30 days)

**No AI tokens used** - database operations only.

---

### Step 6: Report Summary

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

### HARD EXCLUDE if ANY match (do NOT include in output):

**Location (STRICT):**
- ❌ London, Sheffield, Wales, Birmingham, Bristol (or ANY non-Manchester UK city)
- ❌ Overseas remote (not UK)
- ✅ ONLY allow: Manchester area (Greater Manchester, Salford, Stockport, Bolton, Oldham, Rochdale, Bury, Wigan, Trafford) OR Remote UK

**Other exclusions:**
- Contract / freelance / part-time
- Gambling (Bet365, Flutter, Entain)
- **Posted >14 days ago** (stale, not fresh enough)
- **Lead/Principal roles** (any discipline)
- **Strong "UI Designer" emphasis** (title starts with "UI" or "UI/UX")
- Senior Product Designer
- Junior UX under £50k
- Engineering/developer roles
- Product managers
- Physical product design (CAD, mechanical)
- Service/digital/content designer

### Scoring (0-25):
| Factor | Points |
|--------|--------|
| e-commerce, retail, user research, conversion, figma | +3 each |
| b2b, saas, prototyping, design system | +2 each |
| **Senior UX Designer** | +3 |
| Mid UX | +2 |
| Remote | +2 |
| £80k+ | +3 |
| £65-79k | +2 |
| £50-64k | +1 |
| Recruiter InMail | +3 |
| <2 weeks old | +2 |
| **"UX/UI" (UI secondary)** | 0 penalty |
| **"UI/UX" or "UI Designer" focus** | -5 |

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
  "seniority": "mid|senior|junior",
  "roleType": "ux|product",
  "freshness": "fresh|recent|stale",
  "description": "Brief role summary",
  "suitability": 18,
  "postedAt": "2026-01-01T00:00:00Z",
  "directJobUrl": "https://company.com/jobs/ux-designer-123",
  "expired": false,
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
├── agents/CLAUDE.md           # This file - main instructions
├── candidates/                # Job data files (JSON)
│   ├── adzuna.json           # Jobs from Adzuna API
│   ├── reed.json             # Jobs from Reed API
│   └── research-queue.json   # Jobs needing research (generated)
├── scripts/
│   ├── fetch-adzuna.js       # Fetch from Adzuna API
│   ├── fetch-reed.js         # Fetch from Reed API
│   ├── filter-new.js         # Filter new jobs (Phase 2)
│   ├── merge-research.js     # Merge research results (Phase 4)
│   ├── sync-jobs.js          # Sync to database (Phase 5)
│   ├── update-research.js    # Update single job research
│   └── auto-ghost.js         # Mark stale applications as ghosted
├── src/                       # React dashboard
└── supabase-schema.sql        # Database schema
```

## NPM Scripts

```bash
# Development
npm run dev              # Start dashboard localhost:5173
npm run build            # Production build

# Job Search Workflow
npm run fetch:adzuna     # Fetch from Adzuna API
npm run fetch:reed       # Fetch from Reed API
npm run fetch:all        # Fetch from both APIs
npm run filter:new       # Filter new jobs → research-queue.json
npm run merge:research   # Merge research results into candidates
npm run sync             # Sync candidates to Supabase

# Maintenance
npm run auto-ghost       # Mark stale applications as ghosted
npm run update-research  # Update research for single job
npm run reset            # Reset database (DANGER)
```

---

## Token Optimization Strategy

**Problem:** Originally, Sonnet agents handled filtering and merging (Phases 2 & 4), consuming 10-20k tokens per job search.

**Solution:** Replace deterministic data operations with scripts:
- **Phase 2 (Filter):** Simple database lookups → `filter-new.js` (0 tokens)
- **Phase 4 (Merge):** JSON field updates → `merge-research.js` (0 tokens)
- **Phase 3 (Research):** Kept as Haiku agents (requires AI for web analysis)

**Result:** ~80% token reduction per job search. Only AI usage is research (highest value activity).

**Why scripts work here:**
- Filtering: Just comparing IDs and scores (no judgment needed)
- Merging: Copying fields from one JSON to another (deterministic)
- Research: Requires web searches, URL verification, red flag analysis (needs AI)

**Maintenance:** If you modify job schema, update:
1. `scripts/filter-new.js` - deduplication logic
2. `scripts/merge-research.js` - field mapping
3. `scripts/sync-jobs.js` - database mapping

---

## Development Workflow

### TODO-Driven Development

When implementing features or fixes, use inline TODOs to track incomplete work:

```javascript
// TODO: [MISSING] Description of what needs to be implemented
// TODO: [REFACTOR] Description of improvement needed
// TODO: [TEST] Description of test needed
```

**Rules:**
- Insert TODOs at the EXACT code location where work is needed
- Use categories: `[MISSING]`, `[REFACTOR]`, `[TEST]`, `[DEFERRED]`
- Resolve TODOs before marking work complete
- Never claim "done" if TODOs remain in modified files

### Making Changes

1. **Read first** - Understand existing code before modifying
2. **Small commits** - One feature/fix per commit
3. **Test locally** - Run `npm run dev` and verify changes
4. **Update types** - Keep `src/types/job.ts` in sync with schema changes

### Model Usage

| Task | Model | Why |
|------|-------|-----|
| Scraping (parallel) | Haiku | Fast, cheap, handles web fetching |
| Company research | Haiku | Parallel execution, simple task |
| Orchestration | Sonnet | Coordinates workflow, filters results |
| Complex features | Sonnet | Code generation, refactoring |

**Never use Opus** - too token-heavy for this project.

### Application Status Flow

```
new ──→ awaiting ──→ interview ──→ offer
           │             │
           ▼             ▼
        ghosted      rejected
```

When user clicks "Mark Applied":
1. `status` → `awaiting`
2. `applied_at` → current timestamp

After 30 days with no update:
- Supabase pg_cron runs `auto_ghost_jobs()` function daily
- `status` → `ghosted`
