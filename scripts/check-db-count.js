import { query } from '../lib/db.js';

async function main() {
  const countResult = await query('SELECT COUNT(*)::int AS count FROM jobs');
  const total = countResult.rows[0]?.count || 0;

  const dataResult = await query(
    `
    SELECT title, company, location
    FROM jobs
    ORDER BY created_at DESC
    LIMIT 200
    `
  );

  console.log('Total jobs:', total);
  console.log('Jobs:');
  dataResult.rows.forEach((job) => {
    console.log(`- ${job.title} at ${job.company} (${job.location})`);
  });
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
