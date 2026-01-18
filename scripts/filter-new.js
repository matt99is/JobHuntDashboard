/**
 * Job Search - Filter New Jobs
 *
 * Identifies which jobs from candidates/*.json are NEW (not already in database)
 * and prepares a research queue for jobs that meet the suitability threshold.
 *
 * This script REPLACES the manual Sonnet agent filtering step to reduce token usage.
 *
 * WORKFLOW POSITION: Phase 2 (after API fetch, before company research)
 *
 * INPUTS:
 *   - candidates/adzuna.json (from fetch-adzuna.js)
 *   - candidates/reed.json (from fetch-reed.js)
 *   - Supabase jobs table (to check existing jobs)
 *
 * OUTPUTS:
 *   - candidates/research-queue.json (jobs needing company research)
 *   - Console summary showing new vs existing jobs
 *
 * CRITERIA FOR RESEARCH:
 *   1. Job is NEW (not in database by ID or company+title match)
 *   2. Suitability score >= 15 (configurable threshold)
 *   3. Not marked as recruiter placeholder (type !== 'recruiter')
 *
 * USAGE:
 *   npm run filter:new
 *
 * REQUIRES:
 *   - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
 *
 * MAINTENANCE NOTES:
 *   - If you add new candidate sources, add them to SOURCES array
 *   - Adjust RESEARCH_THRESHOLD if you want to research more/fewer jobs
 *   - The deduplication logic matches sync-jobs.js for consistency
 *
 * @author Job Hunt Dashboard
 * @since 2026-01-18 (Token optimization update)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// === CONFIGURATION ===

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load environment variables from .env.local
dotenv.config({ path: path.join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

// Exit early if credentials missing
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Candidate sources to check (must match filenames in candidates/ directory)
const SOURCES = ['linkedin', 'uiuxjobsboard', 'workinstartups', 'indeed', 'adzuna', 'reed'];

// Minimum suitability score to trigger company research
// Jobs below this threshold will be synced but not researched
const RESEARCH_THRESHOLD = 10;

// === HELPER FUNCTIONS ===

/**
 * Generate consistent job ID for deduplication
 *
 * This MUST match the generateId function in sync-jobs.js to ensure
 * we're comparing the same IDs when checking for duplicates.
 *
 * @param {Object} job - Job object with source, company, title
 * @returns {string} - Normalized job ID (e.g., "adzuna-acme-corp-ux-designer")
 */
function generateId(job) {
  const norm = (s) => (s || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')  // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')          // Collapse multiple hyphens
    .slice(0, 30);                // Limit length for database compatibility

  return `${norm(job.source)}-${norm(job.company)}-${norm(job.title)}`;
}

/**
 * Load all candidate files from candidates/ directory
 *
 * Reads JSON files for each source and combines them into a single array.
 * Missing files are skipped (not an error - just means no jobs from that source).
 * Invalid JSON files are logged as errors but don't crash the script.
 *
 * @returns {Array} - All jobs from all sources with IDs generated
 */
function loadCandidates() {
  const dir = path.join(ROOT, 'candidates');
  let all = [];

  for (const src of SOURCES) {
    const file = path.join(dir, `${src}.json`);

    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        console.log(`  ${src}: ${data.length} jobs`);

        // Add ID to each job (may already exist, but regenerate for consistency)
        all = all.concat(data.map(j => ({ ...j, id: j.id || generateId(j) })));
      } catch (e) {
        console.error(`  ${src}: ❌ ERROR - ${e.message}`);
      }
    } else {
      console.log(`  ${src}: no file (skipped)`);
    }
  }

  return all;
}

/**
 * Deduplicate jobs by company+title (keep highest score)
 *
 * When multiple sources return the same job, we keep the one with the
 * highest suitability score. This matches the deduplication logic in sync-jobs.js.
 *
 * WHY: Different job boards may list the same role with different metadata.
 * We trust the source that scored it highest.
 *
 * @param {Array} jobs - Array of job objects
 * @returns {Array} - Deduplicated jobs
 */
function dedupe(jobs) {
  const seen = new Map();

  for (const job of jobs) {
    const key = `${job.company?.toLowerCase()}-${job.title?.toLowerCase()}`;

    // Keep this job if we haven't seen it OR if it has a higher score
    if (!seen.has(key) || job.suitability > seen.get(key).suitability) {
      seen.set(key, job);
    }
  }

  return Array.from(seen.values());
}

/**
 * Fetch existing jobs from Supabase
 *
 * We only need ID, company, and title to check for duplicates.
 * This is much more efficient than fetching all columns.
 *
 * @returns {Promise<Array>} - Existing jobs from database
 * @throws {Error} - If Supabase query fails
 */
async function fetchExistingJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, company');

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Filter jobs to only NEW jobs not in database
 *
 * A job is considered "existing" if either:
 *   1. The ID matches (exact same job from same source)
 *   2. The company+title combination matches (same job from different source)
 *
 * This prevents duplicate jobs from being researched or re-synced.
 *
 * @param {Array} jobs - Candidate jobs to check
 * @param {Array} existing - Jobs already in database
 * @returns {Array} - Only NEW jobs
 */
function filterNewJobs(jobs, existing) {
  // Build lookup sets for fast O(1) checking
  const existingIds = new Set(existing.map(j => j.id));
  const existingKeys = new Set(
    existing.map(j => `${j.company?.toLowerCase()}-${j.title?.toLowerCase()}`)
  );

  return jobs.filter(job => {
    const key = `${job.company?.toLowerCase()}-${job.title?.toLowerCase()}`;

    // Keep job only if BOTH checks fail (not in database)
    return !existingIds.has(job.id) && !existingKeys.has(key);
  });
}

/**
 * Filter jobs that need company research
 *
 * Research is EXPENSIVE (Haiku agents + web searches), so we only research jobs that:
 *   1. Meet minimum suitability threshold
 *   2. Are not already marked as recruiters (detected by API fetch scripts)
 *
 * @param {Array} jobs - New jobs to evaluate
 * @returns {Array} - Jobs that need research
 */
function filterNeedsResearch(jobs) {
  return jobs.filter(job => {
    // Skip if below threshold
    if ((job.suitability || 0) < RESEARCH_THRESHOLD) {
      return false;
    }

    // Skip if already marked as recruiter by API fetch scripts
    // (No point researching recruiters - we already know they are)
    if (job.type === 'recruiter') {
      return false;
    }

    return true;
  });
}

// === MAIN EXECUTION ===

async function main() {
  console.log('\n=== FILTER NEW JOBS ===\n');

  // Step 1: Load all candidate files
  console.log('Loading candidates...');
  const all = loadCandidates();
  console.log(`\nTotal loaded: ${all.length}\n`);

  if (all.length === 0) {
    console.log('ℹ️  No candidates to filter. Run npm run fetch:all first.\n');
    return;
  }

  // Step 2: Dedupe internally (across sources)
  const unique = dedupe(all);
  console.log(`After internal dedupe: ${unique.length} (removed ${all.length - unique.length} duplicates)\n`);

  // Step 3: Fetch existing jobs from database
  console.log('Checking existing jobs in database...');
  let existing;
  try {
    existing = await fetchExistingJobs();
    console.log(`Found ${existing.length} existing jobs\n`);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  // Step 4: Filter to only NEW jobs
  const newJobs = filterNewJobs(unique, existing);
  console.log(`New jobs (not in database): ${newJobs.length}\n`);

  if (newJobs.length === 0) {
    console.log('✅ No new jobs found. Database is up to date.\n');

    // Write empty research queue
    const queuePath = path.join(ROOT, 'candidates', 'research-queue.json');
    fs.writeFileSync(queuePath, JSON.stringify([], null, 2));

    return;
  }

  // Step 5: Filter to jobs that need research
  const needsResearch = filterNeedsResearch(newJobs);
  console.log(`Jobs needing research (suitability >= ${RESEARCH_THRESHOLD}): ${needsResearch.length}\n`);

  // Step 6: Write research queue
  const queuePath = path.join(ROOT, 'candidates', 'research-queue.json');
  fs.writeFileSync(queuePath, JSON.stringify(needsResearch, null, 2));
  console.log(`📝 Research queue written to: ${queuePath}\n`);

  // Step 7: Summary report
  console.log('=== SUMMARY ===\n');
  console.log(`Total candidates: ${all.length}`);
  console.log(`After dedupe: ${unique.length}`);
  console.log(`New jobs: ${newJobs.length}`);
  console.log(`Needs research: ${needsResearch.length}`);
  console.log(`Skipped (low score or recruiter): ${newJobs.length - needsResearch.length}\n`);

  // Step 8: Show top jobs to research
  if (needsResearch.length > 0) {
    console.log('Top jobs for research:');
    needsResearch
      .sort((a, b) => b.suitability - a.suitability)
      .slice(0, 5)
      .forEach((j, i) => {
        console.log(`  ${i + 1}. ${j.title} at ${j.company} (score: ${j.suitability})`);
      });
    console.log('');
  }

  // Step 9: Next steps guidance
  console.log('🔜 NEXT STEPS:');
  if (needsResearch.length > 0) {
    console.log(`   1. Research ${needsResearch.length} companies using Haiku agents`);
    console.log('   2. Run npm run merge:research to update candidate files');
    console.log('   3. Run npm run sync to add to database\n');
  } else {
    console.log('   1. Run npm run sync to add low-scoring jobs directly\n');
  }
}

// Execute with error handling
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
