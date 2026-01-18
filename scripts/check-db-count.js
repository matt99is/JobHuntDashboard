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

const { data, error, count } = await supabase
  .from('jobs')
  .select('*', { count: 'exact' });

if (error) {
  console.error('Error:', error);
} else {
  console.log('Total jobs:', count);
  console.log('Jobs:');
  data.forEach(job => {
    console.log(`- ${job.title} at ${job.company} (${job.location})`);
  });
}
