import { query } from '../lib/db.js';

async function main() {
  const { rows: jobs } = await query('SELECT title, company, location, remote FROM jobs');

  console.log('\n=== LOCATION VERIFICATION ===\n');

  const manchester = [];
  const remote = [];
  const suspicious = [];

  jobs.forEach((job) => {
    const loc = (job.location || '').toLowerCase();

    const isManchester = loc.includes('manchester') ||
                         loc.includes('salford') ||
                         loc.includes('stockport') ||
                         loc.includes('altrincham');

    if (isManchester) {
      manchester.push(job);
    } else if (job.remote || loc.includes('remote')) {
      remote.push(job);
    } else {
      suspicious.push(job);
    }
  });

  console.log(`Manchester area: ${manchester.length} jobs ✅`);
  console.log(`Remote UK: ${remote.length} jobs ✅`);
  console.log(`Suspicious: ${suspicious.length} jobs ⚠️\n`);

  if (suspicious.length > 0) {
    console.log('SUSPICIOUS JOBS (need review):\n');
    suspicious.forEach((job) => {
      console.log(`- ${job.title} at ${job.company}`);
      console.log(`  Location: ${job.location}`);
      console.log(`  Remote flag: ${job.remote}\n`);
    });
  }
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
