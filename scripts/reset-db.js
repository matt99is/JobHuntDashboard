/**
 * Reset database - wipe all jobs and ensure schema is up to date
 * Usage: npm run reset
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function main() {
  console.log('\n=== DATABASE RESET ===\n');

  // Delete all jobs
  console.log('Deleting all jobs...');
  const { error: deleteErr } = await supabase
    .from('jobs')
    .delete()
    .neq('id', '');  // Delete all rows

  if (deleteErr) {
    console.error('Delete failed:', deleteErr.message);
    return;
  }

  // Verify empty
  const { count } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true });

  console.log(`Done. Jobs remaining: ${count || 0}\n`);
  console.log('Note: Run this SQL in Supabase dashboard to add posted_at column:');
  console.log('  ALTER TABLE jobs ADD COLUMN IF NOT EXISTS posted_at timestamp with time zone;\n');
}

main().catch(console.error);
