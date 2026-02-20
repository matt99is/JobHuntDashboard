/**
 * Reset database - wipe all jobs in local PostgreSQL
 * Usage: npm run reset
 */

import { query } from '../lib/db.js';

async function main() {
  console.log('\n=== DATABASE RESET ===\n');

  console.log('Deleting all jobs...');
  await query('DELETE FROM jobs');

  const { rows } = await query('SELECT COUNT(*)::int AS count FROM jobs');
  const count = rows[0]?.count || 0;

  console.log(`Done. Jobs remaining: ${count}\n`);
}

main().catch((error) => {
  console.error('Reset failed:', error.message);
  process.exit(1);
});
