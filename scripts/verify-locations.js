import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: jobs } = await supabase
  .from('jobs')
  .select('title, company, location, remote');

console.log('\n=== LOCATION VERIFICATION ===\n');

const manchester = [];
const remote = [];
const suspicious = [];

jobs.forEach(job => {
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
  suspicious.forEach(job => {
    console.log(`- ${job.title} at ${job.company}`);
    console.log(`  Location: ${job.location}`);
    console.log(`  Remote flag: ${job.remote}\n`);
  });
}
