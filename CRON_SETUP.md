# Auto-Ghost Cron Job Setup

This document explains how to automatically mark jobs as "ghosted" after 30 days of no response.

## Options Overview

| Option | Cost | Complexity | Best For |
|--------|------|------------|----------|
| **GitHub Actions** | Free | Easy | Recommended for most users |
| **Manual** | Free | Easiest | Testing or small scale |
| **Supabase pg_cron** | Free | Medium | Database-native solution |
| **Netlify Functions** | $19/mo | Medium | Already on Netlify Pro |

---

## Option 1: GitHub Actions (Recommended ✅)

**Pros:** Free, automated, version controlled, easy to monitor

**Setup Steps:**

1. **Add GitHub Secrets**
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Add two secrets:
     - `VITE_SUPABASE_URL` = your Supabase URL
     - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

2. **Enable GitHub Actions**
   - The workflow file is already created at `.github/workflows/auto-ghost.yml`
   - Push to GitHub and it will run automatically daily at 2 AM UTC
   - Or manually trigger: Actions tab → "Auto-ghost stale applications" → Run workflow

3. **Monitor**
   - Check the Actions tab to see run history and logs

**Test it now:**
```bash
# Manually trigger from Actions tab or run locally first
npm run auto-ghost
```

---

## Option 2: Manual (Simplest for Testing)

Just run the script whenever you want:

```bash
npm run auto-ghost
```

**Set up Windows Task Scheduler (optional):**
1. Open Task Scheduler
2. Create Basic Task → Daily → 2:00 AM
3. Action: Start a program
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `scripts/auto-ghost.js`
   - Start in: `C:\Projects\JobHuntDashboard`

**Set up macOS/Linux cron (optional):**
```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * cd /path/to/JobHuntDashboard && npm run auto-ghost >> logs/auto-ghost.log 2>&1
```

---

## Option 3: Supabase pg_cron

**Pros:** Runs inside the database, no external dependencies

**Setup Steps:**

1. **Check if pg_cron is available**
   - Supabase Dashboard → Database → Extensions
   - Look for `pg_cron` - enable it if available
   - Note: May not be available on all plans

2. **Run the SQL**
   - Open `supabase-cron.sql`
   - Copy the contents
   - Paste in Supabase Dashboard → SQL Editor → New Query
   - Run it

3. **Verify**
   ```sql
   -- Check scheduled jobs
   SELECT * FROM cron.job;
   ```

**To disable:**
```sql
SELECT cron.unschedule('auto-ghost-jobs-daily');
```

---

## Option 4: Netlify Scheduled Functions

**Pros:** Integrates with your hosting setup

**Cons:** Requires Netlify Pro plan ($19/month)

**Setup Steps:**

1. **Upgrade to Netlify Pro** (if not already)

2. **Deploy the function**
   - The function is already at `netlify/functions/auto-ghost.js`
   - Push to GitHub and Netlify will deploy it automatically

3. **Add environment variables in Netlify**
   - Netlify Dashboard → Site settings → Environment variables
   - Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

4. **Verify**
   - Netlify Dashboard → Functions → auto-ghost
   - Check logs to see scheduled runs

**Manual trigger:**
```bash
# Call the function URL
curl https://your-site.netlify.app/.netlify/functions/auto-ghost
```

---

## Testing the Auto-Ghost Script

Before setting up automation, test it manually:

```bash
# Run the script
npm run auto-ghost

# Expected output:
# === AUTO-GHOST STALE APPLICATIONS ===
#
# Looking for jobs applied before: 2025-12-11
# Found 3 stale job(s):
#   1. Company A - Job Title (45 days ago)
#   2. Company B - Job Title (35 days ago)
#
# ✅ Ghosted 2 job(s)
```

---

## Customizing the Threshold

To change from 30 days to a different value:

**In `scripts/auto-ghost.js`:**
```javascript
const GHOST_THRESHOLD_DAYS = 30; // Change this number
```

**In `supabase-cron.sql`:**
```sql
AND applied_at < NOW() - INTERVAL '30 days'  -- Change '30 days'
```

---

## Recommended Setup

For most users:

1. **Start with manual:** Run `npm run auto-ghost` weekly
2. **Automate with GitHub Actions:** Free and reliable
3. **Monitor:** Check the Actions tab occasionally to verify it's running

---

## Troubleshooting

**"No stale jobs found"**
- ✅ Good! All your applications are recent
- Or you don't have any jobs with status='awaiting' and applied_at set

**GitHub Action fails**
- Check that secrets are set correctly
- Verify the secret names match exactly (case-sensitive)

**Supabase pg_cron not found**
- pg_cron may not be available on your Supabase plan
- Use GitHub Actions instead

**Want to undo ghosting?**
```sql
-- Reset ghosted jobs back to awaiting
UPDATE jobs
SET status = 'awaiting', outcome_notes = null
WHERE status = 'ghosted';
```
