/**
 * Update Research - Helper script for Claude Code
 *
 * Updates a job's research fields in Supabase.
 *
 * Usage: node scripts/update-research.js <job-id> <json-data>
 *
 * Example:
 *   node scripts/update-research.js "linkedin-acme-ux-designer" '{"career_page_url":"https://acme.com/careers","red_flags":[],"research_status":"complete"}'
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const [,, jobId, jsonData] = process.argv;

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
  } catch (e) {
    console.error('Invalid JSON:', e.message);
    process.exit(1);
  }

  // Validate research_status if provided
  const validStatuses = ['pending', 'researching', 'complete', 'skipped', 'failed'];
  if (data.research_status && !validStatuses.includes(data.research_status)) {
    console.error(`Invalid research_status. Must be one of: ${validStatuses.join(', ')}`);
    process.exit(1);
  }

  // Build update object with only allowed fields
  const update = {};
  if (data.career_page_url !== undefined) update.career_page_url = data.career_page_url;
  if (data.red_flags !== undefined) update.red_flags = data.red_flags;
  if (data.research_status !== undefined) update.research_status = data.research_status;
  if (data.research_status === 'complete') update.researched_at = new Date().toISOString();

  if (Object.keys(update).length === 0) {
    console.error('No valid fields to update. Allowed: career_page_url, red_flags, research_status');
    process.exit(1);
  }

  console.log(`Updating job: ${jobId}`);
  console.log('Data:', JSON.stringify(update, null, 2));

  const { error } = await supabase
    .from('jobs')
    .update(update)
    .eq('id', jobId);

  if (error) {
    console.error('Update failed:', error.message);
    process.exit(1);
  }

  console.log('Updated successfully');
}

main().catch(console.error);
