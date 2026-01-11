/**
 * Auto-ghost stale applications
 *
 * Marks jobs as 'ghosted' if:
 * - Status is 'awaiting'
 * - Applied more than 30 days ago
 * - No response received
 *
 * Usage:
 *   node scripts/auto-ghost.js
 *   npm run auto-ghost  (if you add to package.json)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const GHOST_THRESHOLD_DAYS = 30;

async function autoGhost() {
  console.log('\n=== AUTO-GHOST STALE APPLICATIONS ===\n');

  const cutoffDate = new Date(Date.now() - GHOST_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  console.log(`Looking for jobs applied before: ${cutoffDate.toISOString().split('T')[0]}`);

  // Find jobs to ghost
  const { data: jobsToGhost, error: selectError } = await supabase
    .from('jobs')
    .select('id, company, title, applied_at')
    .eq('status', 'awaiting')
    .lt('applied_at', cutoffDate.toISOString());

  if (selectError) {
    console.error('❌ Error finding jobs:', selectError.message);
    process.exit(1);
  }

  if (!jobsToGhost || jobsToGhost.length === 0) {
    console.log('✅ No stale jobs found. All applications are recent.\n');
    return;
  }

  console.log(`Found ${jobsToGhost.length} stale job(s):\n`);

  jobsToGhost.forEach((job, i) => {
    const daysAgo = Math.floor((Date.now() - new Date(job.applied_at)) / (24 * 60 * 60 * 1000));
    console.log(`  ${i + 1}. ${job.company} - ${job.title} (${daysAgo} days ago)`);
  });

  // Update to ghosted
  const { data: updated, error: updateError } = await supabase
    .from('jobs')
    .update({
      status: 'ghosted',
      outcome_notes: `Auto-ghosted after ${GHOST_THRESHOLD_DAYS} days no response`
    })
    .in('id', jobsToGhost.map(j => j.id))
    .select('id, company, title');

  if (updateError) {
    console.error('❌ Error updating jobs:', updateError.message);
    process.exit(1);
  }

  console.log(`\n✅ Ghosted ${updated.length} job(s)\n`);
}

autoGhost().catch(console.error);
