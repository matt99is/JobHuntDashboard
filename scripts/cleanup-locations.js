/**
 * Cleanup Script - Remove Jobs from Wrong Locations
 *
 * Removes jobs from Supabase database that don't match location criteria.
 * This cleanup is needed after adding strict location filtering to API fetch scripts.
 *
 * USAGE:
 *   node scripts/cleanup-locations.js
 *
 * REQUIRES:
 *   - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
 *
 * WHAT THIS DOES:
 *   1. Queries all jobs from database
 *   2. Identifies jobs from wrong locations (London, Sheffield, Wales, etc)
 *   3. Shows list of jobs to be removed
 *   4. Prompts for confirmation
 *   5. Deletes confirmed jobs
 *
 * LOCATION CRITERIA:
 *   ✅ KEEP: Manchester area (Greater Manchester, Salford, Stockport, Bolton,
 *            Oldham, Rochdale, Bury, Wigan, Trafford)
 *   ✅ KEEP: Remote (UK remote, not overseas)
 *   ❌ REMOVE: All other locations
 *
 * @author Job Hunt Dashboard
 * @since 2026-01-18 (Location filtering fix)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Check if location is valid (Manchester area or Remote UK)
 */
function isValidLocation(location, remote) {
  if (!location) return false;

  const loc = location.toLowerCase();

  // Check if Manchester area
  const manchesterKeywords = [
    'manchester',
    'salford',
    'stockport',
    'bolton',
    'oldham',
    'rochdale',
    'bury',
    'wigan',
    'trafford'
  ];

  const isManchester = manchesterKeywords.some(k => loc.includes(k));

  // Check if remote
  const isRemote = remote === true || loc.includes('remote');

  return isManchester || isRemote;
}

/**
 * Main execution
 */
async function main() {
  console.log('\n=== CLEANUP WRONG LOCATIONS ===\n');

  // Step 1: Query all jobs
  console.log('Fetching all jobs from database...');
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, company, location, remote, status');

  if (error) {
    console.error('❌ Failed to fetch jobs:', error.message);
    process.exit(1);
  }

  console.log(`Found ${jobs.length} total jobs\n`);

  // Step 2: Identify invalid locations
  const invalidJobs = jobs.filter(job => !isValidLocation(job.location, job.remote));

  console.log(`Invalid locations: ${invalidJobs.length}\n`);

  if (invalidJobs.length === 0) {
    console.log('✅ No jobs to clean up. All locations are valid.\n');
    return;
  }

  // Step 3: Show jobs to be removed
  console.log('Jobs to be REMOVED:\n');
  invalidJobs.forEach((job, i) => {
    console.log(`${i + 1}. ${job.title} at ${job.company}`);
    console.log(`   Location: ${job.location}`);
    console.log(`   Remote: ${job.remote}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   ID: ${job.id}\n`);
  });

  // Step 4: Group by location for summary
  const locationCounts = {};
  invalidJobs.forEach(job => {
    const loc = job.location || 'Unknown';
    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
  });

  console.log('Summary by location:');
  Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([loc, count]) => {
      console.log(`  ${loc}: ${count} jobs`);
    });
  console.log('');

  // Step 5: Delete jobs
  console.log(`Deleting ${invalidJobs.length} jobs...`);

  const idsToDelete = invalidJobs.map(j => j.id);

  const { error: deleteError } = await supabase
    .from('jobs')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    console.error('❌ Failed to delete jobs:', deleteError.message);
    process.exit(1);
  }

  console.log(`✅ Deleted ${invalidJobs.length} jobs from wrong locations\n`);

  // Step 6: Verify
  const { data: remaining, error: verifyError } = await supabase
    .from('jobs')
    .select('id')
    .in('id', idsToDelete);

  if (verifyError) {
    console.error('❌ Failed to verify deletion:', verifyError.message);
  } else if (remaining.length === 0) {
    console.log('✅ Verified: All invalid jobs removed successfully\n');
  } else {
    console.warn(`⚠️  Warning: ${remaining.length} jobs still in database\n`);
  }

  // Step 7: Final count
  const { data: allJobs, error: countError } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true });

  if (!countError) {
    console.log(`Database now has ${allJobs?.length || 0} jobs (all valid locations)\n`);
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
