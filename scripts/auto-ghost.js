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

import { query } from '../lib/db.js';

const GHOST_THRESHOLD_DAYS = 30;

async function autoGhost() {
  console.log('\n=== AUTO-GHOST STALE APPLICATIONS ===\n');

  const cutoffDate = new Date(Date.now() - GHOST_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  console.log(`Looking for jobs applied before: ${cutoffDate.toISOString().split('T')[0]}`);

  // Find jobs to ghost
  let jobsToGhost = [];
  try {
    const result = await query(
      `
      SELECT id, company, title, applied_at
      FROM jobs
      WHERE status = 'awaiting'
        AND applied_at < $1
      `,
      [cutoffDate.toISOString()]
    );
    jobsToGhost = result.rows;
  } catch (error) {
    console.error('❌ Error finding jobs:', error.message);
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
  let updated = [];
  try {
    const result = await query(
      `
      UPDATE jobs
      SET
        status = 'ghosted',
        outcome_at = now(),
        outcome_notes = $1
      WHERE id = ANY($2::text[])
      RETURNING id, company, title
      `,
      [
        `Auto-ghosted after ${GHOST_THRESHOLD_DAYS} days no response`,
        jobsToGhost.map((job) => job.id),
      ]
    );
    updated = result.rows;
  } catch (error) {
    console.error('❌ Error updating jobs:', error.message);
    process.exit(1);
  }

  console.log(`\n✅ Ghosted ${updated.length} job(s)\n`);
}

autoGhost().catch(console.error);
