# Job Hunt Dashboard - Claude Code Implementation Brief

## Overview

Build a standalone job tracking dashboard deployed to `jobs.mattlelonek.co.uk`. The dashboard displays job listings with pre-calculated suitability scores, allows status tracking (new → saved → applied), and supports JSON import for adding new roles.

**Key principle:** This is a display and tracking tool only. Suitability scoring and cover letter generation happen in Claude.ai, not in the dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL + REST API) |
| Hosting | Netlify |
| Repository | GitHub |

---

## Design System

Follow Matt's established design system from resources.mattlelonek.co.uk:

### Typography

```css
--font-display: 'Plus Jakarta Sans', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

Import from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Colours

```css
/* Primary */
--terracotta: #B8432F;
--terracotta-light: #D4654F;
--terracotta-dark: #8C3224;

/* Neutrals */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-300: #D1D5DB;
--gray-400: #9CA3AF;
--gray-500: #6B7280;
--gray-600: #4B5563;
--gray-700: #374151;
--gray-800: #1F2937;
--gray-900: #111827;

/* Semantic */
--success: #059669;
--warning: #D97706;
--error: #DC2626;
--info: #2563EB;
```

### Design Principles

- Clean, minimal interface with purposeful whitespace
- Terracotta as accent colour for primary actions and highlights
- No rounded corners on containers (use `rounded-none` or `rounded-sm` max)
- Subtle borders rather than shadows for separation
- Data-dense but scannable layout

---

## Supabase Setup

### 1. Create Project

1. Go to supabase.com and create new project
2. Name: `job-hunt-dashboard`
3. Region: London (eu-west-2)
4. Note the project URL and anon key

### 2. Database Schema

Run this SQL in the Supabase SQL editor:

```sql
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
```

### 3. Environment Variables

Create `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Project Structure

```
job-hunt-dashboard/
├── src/
│   ├── components/
│   │   ├── JobCard.tsx
│   │   ├── JobList.tsx
│   │   ├── FilterBar.tsx
│   │   ├── ImportModal.tsx
│   │   ├── AddJobModal.tsx
│   │   └── Header.tsx
│   ├── lib/
│   │   └── supabase.ts
│   ├── types/
│   │   └── job.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── .env.local
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Type Definitions

```typescript
// src/types/job.ts

export type Seniority = 'junior' | 'mid' | 'senior' | 'lead';
export type RoleType = 'ux' | 'product';
export type ApplicationType = 'direct' | 'recruiter';
export type Freshness = 'fresh' | 'recent' | 'stale' | 'unknown';
export type Status = 'new' | 'interested' | 'applied' | 'rejected' | null;

export interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  url?: string;
  salary?: string;
  remote: boolean;
  seniority?: Seniority;
  role_type?: RoleType;
  application_type?: ApplicationType;
  freshness?: Freshness;
  description?: string;
  source?: string;
  status: Status;
  suitability: number;
  created_at: string;
  updated_at: string;
}

export interface JobImport {
  title: string;
  company: string;
  location?: string;
  url?: string;
  salary?: string;
  remote?: boolean;
  seniority?: Seniority;
  roleType?: RoleType;
  type?: ApplicationType;
  freshness?: Freshness;
  description?: string;
  source?: string;
  suitability?: number;
}
```

---

## Supabase Client

```typescript
// src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions
export async function getJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('suitability', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function updateJobStatus(id: string, status: string | null) {
  const { error } = await supabase
    .from('jobs')
    .update({ status })
    .eq('id', id);
  
  if (error) throw error;
}

export async function deleteJob(id: string) {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function upsertJobs(jobs: any[]) {
  const { error } = await supabase
    .from('jobs')
    .upsert(jobs, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    });
  
  if (error) throw error;
}

export function generateJobId(job: { source?: string; company: string; title: string }): string {
  const normalise = (str: string) => 
    str.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30);
  
  return `${normalise(job.source || 'manual')}-${normalise(job.company)}-${normalise(job.title)}`;
}
```

---

## Component Specifications

### Header

- Dashboard title: "Job Hunt"
- Stats line: "{total} roles · {new} new · {saved} saved · {applied} applied"
- Action buttons: "+ Add Job" (terracotta), "Import" (gray outline)

### FilterBar

Horizontal pill buttons for filtering:
- All
- New ({count})
- Saved ({count})
- Applied ({count})
- 🏠 Remote
- 🎯 Direct
- UX
- Product

Active filter: terracotta background, white text
Inactive: white background, gray border, gray text

### JobCard

Compact card displaying:
- **Row 1:** Title + badges (remote 🏠, salary 💰, seniority 📈 if senior/lead)
- **Row 2:** Company · Location
- **Row 3:** Suitability pill (colour coded) | Freshness indicator | Direct/Recruiter | UX/Product | Source
- **Actions:** View (link), Letter (disabled - handled in Claude), Save ☆/★, Delete ×

Suitability colours:
- 15+: Terracotta background (Excellent)
- 10-14: Blue (Good)
- 6-9: Yellow (Fair)
- 0-5: Gray (Low)

Applied jobs: 60% opacity

### ImportModal

- Textarea for pasting JSON
- Import button
- Validation: Parse JSON, generate IDs, map fields from Claude's format to database format
- On success: upsert to Supabase, close modal, refresh list

Field mapping from Claude JSON to database:
```typescript
{
  roleType -> role_type
  type -> application_type
  // id generated from source + company + title
  // status defaults to 'new'
}
```

### AddJobModal

Manual job entry form with fields:
- Title (required)
- Company (required)
- Location
- URL
- Salary
- Role type (UX/Product dropdown)
- Seniority (Junior/Mid/Senior/Lead dropdown)
- Application type (Direct/Recruiter dropdown)
- Freshness (Fresh/Recent/Stale/Unknown dropdown)
- Remote (checkbox)
- Description (textarea)
- Suitability (number input 0-25, required)

Note: Suitability must be entered manually for manually added jobs, or set to 0. The dashboard does not calculate scores.

---

## Tailwind Configuration

```javascript
// tailwind.config.js

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terracotta: {
          DEFAULT: '#B8432F',
          light: '#D4654F',
          dark: '#8C3224',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
```

---

## Netlify Deployment

### 1. Connect GitHub Repository

1. Push code to GitHub: `github.com/[username]/job-hunt-dashboard`
2. In Netlify, "Add new site" → "Import an existing project"
3. Connect GitHub, select repository
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`

### 2. Environment Variables

In Netlify dashboard → Site settings → Environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Custom Domain

1. In Netlify → Domain settings → Add custom domain
2. Enter: `jobs.mattlelonek.co.uk`
3. Add DNS records as instructed (CNAME or Netlify DNS)
4. Enable HTTPS

---

## Import JSON Format

Claude will provide JSON in this format:

```json
[
  {
    "title": "Senior UX Designer",
    "company": "Example Co",
    "location": "Manchester",
    "source": "LinkedIn",
    "type": "direct",
    "url": "https://...",
    "remote": true,
    "salary": "£65k-75k",
    "seniority": "senior",
    "roleType": "ux",
    "freshness": "fresh",
    "description": "E-commerce, design systems, user research...",
    "suitability": 18
  }
]
```

The import function should:
1. Parse JSON
2. Generate ID for each job using `generateJobId()`
3. Map `roleType` → `role_type`, `type` → `application_type`
4. Set `status` to `'new'` if not present
5. Upsert to Supabase (preserves existing status for matching IDs)

---

## Not In Scope

These features are intentionally excluded from the dashboard:

1. **Suitability calculation** - Claude calculates this at search time
2. **Cover letter generation** - Handled in Claude.ai with full context
3. **Job searching** - Claude searches and provides JSON
4. **URL validation** - Claude validates before including in results
5. **Authentication** - Public dashboard, no login required

---

## Testing Checklist

- [ ] Jobs load from Supabase on page load
- [ ] Filters work correctly
- [ ] Status updates persist to database
- [ ] Delete removes from database
- [ ] Import parses valid JSON
- [ ] Import rejects invalid JSON with error message
- [ ] Import preserves existing job statuses
- [ ] Manual add creates job with generated ID
- [ ] View button opens job URL in new tab
- [ ] Responsive on mobile
- [ ] Custom domain works with HTTPS

---

## Commands to Run

```bash
# Initial setup
npm create vite@latest job-hunt-dashboard -- --template react-ts
cd job-hunt-dashboard
npm install @supabase/supabase-js
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Development
npm run dev

# Build
npm run build

# Deploy (via Netlify CLI)
npm install -g netlify-cli
netlify deploy --prod
```

---

## Summary

This dashboard is a simple, focused tracking tool. All intelligence (scoring, cover letters, job discovery) lives in Claude.ai. The dashboard just needs to:

1. Display jobs sorted by suitability
2. Filter by status/type
3. Update status (save/apply)
4. Import JSON from Claude
5. Delete unwanted jobs

Build it clean, build it fast, follow the design system.
