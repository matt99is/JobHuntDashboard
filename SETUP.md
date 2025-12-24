# Job Hunt Dashboard - Setup Guide

## What's Been Built

A complete job tracking dashboard with:

- ✅ React + TypeScript + Vite setup
- ✅ Tailwind CSS with your design system (terracotta colors, Plus Jakarta Sans font)
- ✅ All components built (Header, FilterBar, JobCard, JobList, ImportModal, AddJobModal)
- ✅ Supabase client with helper functions
- ✅ Complete type definitions
- ✅ Build configuration (Netlify ready)

## Next Steps

### 1. Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
   - Name: `job-hunt-dashboard`
   - Region: London (eu-west-2) or closest to you
   - Generate a strong database password

2. Once the project is created, go to the SQL Editor
   - Click "New Query"
   - Copy and paste the entire contents of `supabase-schema.sql`
   - Click "Run" to create the tables and indexes

3. Get your project credentials:
   - Go to Project Settings → API
   - Copy the "Project URL" (starts with https://...)
   - Copy the "anon public" key (long string)

### 2. Configure Environment Variables

Edit `.env.local` and replace with your actual credentials:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Run the Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### 4. Test the Dashboard

1. **Add a test job manually**:
   - Click "+ Add Job"
   - Fill in: Title: "UX Designer", Company: "Test Co", Suitability: 15
   - Click "Add Job"

2. **Test import**:
   - Click "Import"
   - Paste this sample JSON:
   ```json
   [
     {
       "title": "Senior Product Designer",
       "company": "Example Ltd",
       "location": "Manchester",
       "source": "LinkedIn",
       "type": "direct",
       "url": "https://example.com",
       "remote": true,
       "salary": "£65k-75k",
       "seniority": "senior",
       "roleType": "ux",
       "freshness": "fresh",
       "description": "Great role with design systems focus",
       "suitability": 18
     }
   ]
   ```
   - Click "Import"

3. **Test filters**:
   - Click different filter buttons to see the list update
   - Save a job by clicking the ☆ icon
   - Try the "Saved" filter

### 5. Deploy to Netlify

#### Option A: Via Netlify Dashboard

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Job Hunt Dashboard"
   git remote add origin https://github.com/YOUR-USERNAME/job-hunt-dashboard.git
   git push -u origin main
   ```

2. Go to [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub
   - Select your repository
   - Netlify will auto-detect the build settings (already configured in `netlify.toml`)
   - Add environment variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - Click "Deploy site"

3. Configure custom domain:
   - In Netlify dashboard → Domain settings
   - Add custom domain: `jobs.mattlelonek.co.uk`
   - Follow DNS instructions
   - Enable HTTPS (automatic)

#### Option B: Via Netlify CLI

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Deploy
netlify init

# When prompted:
# - Create & configure a new site
# - Build command: npm run build
# - Deploy directory: dist

# Add environment variables in Netlify dashboard
# Then deploy
netlify deploy --prod
```

## File Structure

```
job-hunt-dashboard/
├── src/
│   ├── components/
│   │   ├── AddJobModal.tsx      # Manual job entry form
│   │   ├── FilterBar.tsx        # Filter buttons
│   │   ├── Header.tsx           # Title, stats, action buttons
│   │   ├── ImportModal.tsx      # JSON import interface
│   │   ├── JobCard.tsx          # Individual job display
│   │   └── JobList.tsx          # Grid of job cards
│   ├── lib/
│   │   └── supabase.ts          # Supabase client & helpers
│   ├── types/
│   │   └── job.ts               # TypeScript type definitions
│   ├── App.tsx                  # Main application
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Global styles + Tailwind
│   └── vite-env.d.ts            # TypeScript env definitions
├── public/
│   └── vite.svg                 # Favicon
├── .env.local                   # Environment variables (git ignored)
├── .env.local.example           # Template for env vars
├── supabase-schema.sql          # Database schema
├── netlify.toml                 # Netlify configuration
├── package.json                 # Dependencies
├── tailwind.config.js           # Tailwind + design system
├── tsconfig.json                # TypeScript config
└── vite.config.ts               # Vite config
```

## Features Overview

### Header
- Shows total jobs count and breakdown by status
- Import and Add Job buttons

### Filters
- All, New, Saved, Applied (with counts)
- Remote, Direct, UX, Product

### Job Cards
- Title with badges (remote, salary, seniority)
- Company and location
- Suitability score with color coding:
  - 15+: Terracotta (Excellent)
  - 10-14: Blue (Good)
  - 6-9: Yellow (Fair)
  - 0-5: Gray (Low)
- Metadata: freshness, application type, role type, source
- Actions: View, Save/Unsave, Delete
- Applied jobs shown at 60% opacity

### Import Modal
- Paste JSON array from Claude
- Auto-generates IDs from source + company + title
- Maps Claude's format to database schema
- Preserves existing job statuses on re-import

### Add Job Modal
- Full form for manual entry
- All fields optional except title, company, and suitability
- Note about manual suitability scoring

## Troubleshooting

### Build fails
- Make sure all dependencies are installed: `npm install`
- Check Node version: `node --version` (should be 18+)

### Supabase connection fails
- Verify `.env.local` has correct credentials
- Check Supabase project is active
- Confirm database schema was created successfully

### Jobs not loading
- Open browser console (F12) to see errors
- Check network tab for failed API calls
- Verify Supabase anon key has correct permissions

### Import fails
- Check JSON is valid (use a JSON validator)
- Ensure required fields (title, company) are present
- Check browser console for specific error

## Support

Refer to:
- Main documentation: `CLAUDE-CODE-HANDOFF-job-dashboard.md`
- README: `README.md`
- Supabase docs: https://supabase.com/docs
- Vite docs: https://vitejs.dev
- Tailwind docs: https://tailwindcss.com

---

Built clean, built fast. Ready to track your job hunt!
