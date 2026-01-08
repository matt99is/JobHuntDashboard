/**
 * Job Search - Sync to Supabase
 *
 * Merges candidate files from agents, deduplicates, and inserts new jobs.
 *
 * Usage: npm run sync
 * Requires: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const SOURCES = ['linkedin', 'uiuxjobsboard', 'workinstartups', 'indeed'];

// Generate consistent job ID for deduplication
function generateId(job) {
  const norm = (s) => (s || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
  return `${norm(job.source)}-${norm(job.company)}-${norm(job.title)}`;
}

// Load all candidate files
function loadCandidates() {
  const dir = path.join(ROOT, 'candidates');
  let all = [];

  for (const src of SOURCES) {
    const file = path.join(dir, `${src}.json`);
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        console.log(`  ${src}: ${data.length} jobs`);
        all = all.concat(data.map(j => ({ ...j, id: j.id || generateId(j) })));
      } catch (e) {
        console.error(`  ${src}: ERROR - ${e.message}`);
      }
    } else {
      console.log(`  ${src}: no file`);
    }
  }
  return all;
}

// Dedupe by company+title (keep highest score)
function dedupe(jobs) {
  const seen = new Map();
  for (const job of jobs) {
    const key = `${job.company?.toLowerCase()}-${job.title?.toLowerCase()}`;
    if (!seen.has(key) || job.suitability > seen.get(key).suitability) {
      seen.set(key, job);
    }
  }
  return Array.from(seen.values());
}

// Suitability threshold for company research
const RESEARCH_THRESHOLD = 15;

// Map to database schema
function toDbRow(job) {
  const suitability = job.suitability || 0;
  // Check both old (directUrl) and new (directJobUrl) field names for compatibility
  const directUrl = job.directJobUrl || job.directUrl || null;
  const hasResearch = directUrl !== null || job.redFlags !== undefined;

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location || null,
    url: job.url || null,
    salary: job.salary || null,
    remote: job.remote || false,
    seniority: job.seniority || null,
    role_type: job.roleType || null,
    application_type: job.type || null,
    freshness: job.freshness || 'unknown',
    description: job.description || null,
    source: job.source || null,
    status: 'new',
    suitability: suitability,
    posted_at: job.postedAt || null,
    // Research fields (populated by job search workflow)
    // directJobUrl = verified link to actual job listing (not guessed careers page)
    career_page_url: directUrl,
    red_flags: job.redFlags || [],
    research_status: hasResearch ? 'complete' : (suitability >= RESEARCH_THRESHOLD ? 'pending' : 'skipped'),
    researched_at: hasResearch ? new Date().toISOString() : null,
  };
}

// Mark jobs older than 30 days as stale (based on posted_at, fallback to created_at)
async function deprecateOldJobs() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();

  // Jobs with posted_at older than 30 days
  const { data: postedOld, error: err1 } = await supabase
    .from('jobs')
    .update({ freshness: 'stale' })
    .lt('posted_at', cutoff)
    .neq('freshness', 'stale')
    .select('id');

  // Jobs without posted_at, using created_at as fallback
  const { data: createdOld, error: err2 } = await supabase
    .from('jobs')
    .update({ freshness: 'stale' })
    .is('posted_at', null)
    .lt('created_at', cutoff)
    .neq('freshness', 'stale')
    .select('id');

  if (err1) console.error('Deprecate (posted_at) failed:', err1.message);
  if (err2) console.error('Deprecate (created_at) failed:', err2.message);

  return (postedOld?.length || 0) + (createdOld?.length || 0);
}

async function main() {
  console.log('\n=== JOB SYNC ===\n');

  // Deprecate old jobs first
  console.log('Checking for stale jobs...');
  const deprecated = await deprecateOldJobs();
  if (deprecated > 0) {
    console.log(`Marked ${deprecated} jobs as stale (>30 days old)\n`);
  }

  // Load
  console.log('Loading candidates...');
  const all = loadCandidates();
  console.log(`\nTotal: ${all.length}\n`);

  if (all.length === 0) {
    console.log('No candidates to sync.\n');
    return;
  }

  // Dedupe internally
  const unique = dedupe(all);
  console.log(`After dedupe: ${unique.length} (removed ${all.length - unique.length})\n`);

  // Fetch existing from Supabase
  console.log('Checking existing jobs...');
  const { data: existing, error: fetchErr } = await supabase.from('jobs').select('id, title, company');

  if (fetchErr) {
    console.error('Failed to fetch existing jobs:', fetchErr.message);
    return;
  }

  const existingIds = new Set(existing.map(j => j.id));
  const existingKeys = new Set(existing.map(j => `${j.company?.toLowerCase()}-${j.title?.toLowerCase()}`));

  // Filter new jobs
  const newJobs = unique.filter(j => {
    const key = `${j.company?.toLowerCase()}-${j.title?.toLowerCase()}`;
    return !existingIds.has(j.id) && !existingKeys.has(key);
  });

  console.log(`Existing: ${existing.length}, New: ${newJobs.length}\n`);

  if (newJobs.length === 0) {
    console.log('No new jobs to add.\n');
    return;
  }

  // Sort by suitability and insert
  newJobs.sort((a, b) => b.suitability - a.suitability);
  const rows = newJobs.map(toDbRow);

  console.log('Inserting...');
  const { error: insertErr } = await supabase.from('jobs').insert(rows);

  if (insertErr) {
    console.error('Insert failed:', insertErr.message);
    // Write fallback
    const fallback = path.join(ROOT, 'candidates', 'failed-import.json');
    fs.writeFileSync(fallback, JSON.stringify(newJobs, null, 2));
    console.log(`Fallback written to ${fallback}`);
    return;
  }

  console.log(`\nInserted ${newJobs.length} jobs\n`);

  // Show top 5
  console.log('Top opportunities:');
  newJobs.slice(0, 5).forEach((j, i) => {
    console.log(`  ${i + 1}. ${j.title} at ${j.company} (${j.suitability})`);
  });
  console.log('');
}

main().catch(console.error);
