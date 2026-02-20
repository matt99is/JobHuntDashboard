/**
 * Cleanup Script - Remove Jobs from Wrong Locations
 *
 * Removes jobs from local PostgreSQL that don't match location criteria.
 *
 * USAGE:
 *   node scripts/cleanup-locations.js
 */

import { query } from '../lib/db.js';

function isValidLocation(location, remote) {
  if (!location) return false;

  const loc = location.toLowerCase();

  const manchesterKeywords = [
    'manchester',
    'salford',
    'stockport',
    'bolton',
    'oldham',
    'rochdale',
    'bury',
    'wigan',
    'trafford',
  ];

  const isManchester = manchesterKeywords.some((k) => loc.includes(k));
  const isRemote = remote === true || loc.includes('remote');

  return isManchester || isRemote;
}

async function main() {
  console.log('\n=== CLEANUP WRONG LOCATIONS ===\n');

  console.log('Fetching all jobs from database...');
  const { rows: jobs } = await query(
    'SELECT id, title, company, location, remote, status FROM jobs'
  );

  console.log(`Found ${jobs.length} total jobs\n`);

  const invalidJobs = jobs.filter((job) => !isValidLocation(job.location, job.remote));

  console.log(`Invalid locations: ${invalidJobs.length}\n`);

  if (invalidJobs.length === 0) {
    console.log('✅ No jobs to clean up. All locations are valid.\n');
    return;
  }

  console.log('Jobs to be REMOVED:\n');
  invalidJobs.forEach((job, i) => {
    console.log(`${i + 1}. ${job.title} at ${job.company}`);
    console.log(`   Location: ${job.location}`);
    console.log(`   Remote: ${job.remote}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   ID: ${job.id}\n`);
  });

  const locationCounts = {};
  invalidJobs.forEach((job) => {
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

  console.log(`Deleting ${invalidJobs.length} jobs...`);
  const idsToDelete = invalidJobs.map((j) => j.id);

  const deleteResult = await query(
    'DELETE FROM jobs WHERE id = ANY($1::text[])',
    [idsToDelete]
  );

  console.log(`✅ Deleted ${deleteResult.rowCount || 0} jobs from wrong locations\n`);

  const verifyResult = await query('SELECT id FROM jobs WHERE id = ANY($1::text[])', [idsToDelete]);
  if (verifyResult.rows.length === 0) {
    console.log('✅ Verified: All invalid jobs removed successfully\n');
  } else {
    console.warn(`⚠️  Warning: ${verifyResult.rows.length} jobs still in database\n`);
  }

  const countResult = await query('SELECT COUNT(*)::int AS count FROM jobs');
  console.log(`Database now has ${countResult.rows[0]?.count || 0} jobs (all valid locations)\n`);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
