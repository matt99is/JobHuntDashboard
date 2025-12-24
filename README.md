# Job Hunt Dashboard

A clean, minimal job tracking dashboard built with React, TypeScript, Tailwind CSS, and Supabase. Track job applications with pre-calculated suitability scores and manage your job hunt workflow.

## Features

- Display jobs sorted by suitability score
- Filter by status (new/saved/applied), remote, application type, and role type
- Update job status with one click
- Import jobs in bulk via JSON
- Manual job entry
- Clean, data-dense interface following Matt's design system

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + REST API)
- **Hosting**: Netlify

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL script in `supabase-schema.sql` in the Supabase SQL editor
3. Get your project URL and anon key from Project Settings → API

### 3. Configure Environment Variables

Copy the example file and add your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Usage

### Import Jobs from Claude

1. Ask Claude to search for jobs and provide results in JSON format
2. Click "Import" button
3. Paste the JSON array
4. Jobs are automatically added with generated IDs

### Add Jobs Manually

1. Click "+ Add Job" button
2. Fill in the form (title and company required)
3. Set your own suitability score (0-25)

### Manage Jobs

- **Save**: Click ☆ to save interesting jobs
- **View**: Click "View" to open job URL
- **Delete**: Click × to remove unwanted jobs
- **Filter**: Use filter buttons to narrow down the list

## Deployment

### Deploy to Netlify

1. Push code to GitHub
2. Connect repository in Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variables in Netlify dashboard
6. Configure custom domain: `jobs.mattlelonek.co.uk`

Or use Netlify CLI:

```bash
npm install -g netlify-cli
netlify deploy --prod
```

## Design System

Following Matt's established design system:

- **Fonts**: Plus Jakarta Sans (display), JetBrains Mono (mono)
- **Primary Color**: Terracotta (#B8432F)
- **Layout**: Clean, minimal, data-dense
- **Borders**: Subtle borders instead of shadows
- **No rounded corners** on containers

## Not In Scope

The dashboard is intentionally simple and focused on display/tracking only:

- ❌ Suitability calculation (handled in Claude)
- ❌ Cover letter generation (handled in Claude)
- ❌ Job searching (handled in Claude)
- ❌ Authentication (public dashboard)

## Project Structure

```
job-hunt-dashboard/
├── src/
│   ├── components/       # React components
│   ├── lib/             # Supabase client
│   ├── types/           # TypeScript types
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
└── [config files]       # Vite, TypeScript, Tailwind
```

## License

Private project for Matt Lelonek
