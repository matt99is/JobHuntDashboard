/**
 * Update Research - Helper script for Claude Code
 *
 * Updates a job's research fields in local PostgreSQL.
 *
 * Usage: node scripts/update-research.js <job-id> <json-data>
 *
 * Example:
 *   node scripts/update-research.js "linkedin-acme-ux-designer" '{"career_page_url":"https://acme.com/careers","red_flags":[],"research_status":"complete"}'
 */

import { query } from '../lib/db.js';

async function main() {
  const [, , jobId, jsonData] = process.argv;

  if (!jobId || !jsonData) {
    console.error('Usage: node scripts/update-research.js <job-id> <json-data>');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/update-research.js "linkedin-acme-ux" \'{"career_page_url":"https://acme.com/careers","red_flags":[],"research_status":"complete"}\'');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(jsonData);
  } catch (error) {
    console.error('Invalid JSON:', error.message);
    process.exit(1);
  }

  const validStatuses = ['pending', 'researching', 'complete', 'skipped', 'failed'];
  if (data.research_status && !validStatuses.includes(data.research_status)) {
    console.error(`Invalid research_status. Must be one of: ${validStatuses.join(', ')}`);
    process.exit(1);
  }

  const update = {};
  if (data.career_page_url !== undefined) update.career_page_url = data.career_page_url;
  if (data.red_flags !== undefined) update.red_flags = data.red_flags;
  if (data.research_status !== undefined) update.research_status = data.research_status;
  if (data.research_status === 'complete') update.researched_at = new Date().toISOString();

  if (Object.keys(update).length === 0) {
    console.error('No valid fields to update. Allowed: career_page_url, red_flags, research_status');
    process.exit(1);
  }

  const fields = Object.keys(update);
  const assignments = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
  const values = fields.map((field) =>
    field === 'red_flags' ? JSON.stringify(update[field]) : update[field]
  );
  values.push(jobId);

  console.log(`Updating job: ${jobId}`);
  console.log('Data:', JSON.stringify(update, null, 2));

  const result = await query(
    `UPDATE jobs SET ${assignments} WHERE id = $${values.length}`,
    values
  );

  if ((result.rowCount || 0) === 0) {
    console.error('Update failed: job not found');
    process.exit(1);
  }

  console.log('Updated successfully');
}

main().catch((error) => {
  console.error('Update failed:', error.message);
  process.exit(1);
});
