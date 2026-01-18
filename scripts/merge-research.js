/**
 * Job Search - Merge Research Results
 *
 * Merges company research results from AI agents back into candidate files
 * and prepares them for database sync.
 *
 * This script REPLACES the manual Sonnet agent merging step to reduce token usage.
 *
 * WORKFLOW POSITION: Phase 4 (after company research, before sync)
 *
 * INPUTS:
 *   - candidates/research-queue.json (jobs that were researched)
 *   - candidates/adzuna.json (original candidate data)
 *   - candidates/reed.json (original candidate data)
 *   - Research results from AI agents (passed as JSON string or file)
 *
 * OUTPUTS:
 *   - Updates candidates/*.json with:
 *     - directJobUrl (verified URL to job listing or null)
 *     - expired (true/false - whether job is still active)
 *     - redFlags (array of red flag objects)
 *     - type ('recruiter' if research found is_recruiter: true)
 *   - Filters out expired jobs before sync
 *   - Console summary of what was updated
 *
 * USAGE:
 *   # Option 1: Pass research results as file
 *   npm run merge:research -- --results=research-results.json
 *
 *   # Option 2: Provide results via stdin (for piping from agents)
 *   echo '[{...}]' | npm run merge:research
 *
 * RESEARCH RESULT FORMAT (from Haiku agents):
 *   [{
 *     "id": "adzuna-acme-corp-ux-designer",
 *     "company": "Acme Corp",
 *     "is_recruiter": false,
 *     "direct_job_url": "https://acme.com/careers/ux-designer-123",
 *     "expired": false,
 *     "red_flags": [
 *       {
 *         "type": "layoffs",
 *         "severity": "high",
 *         "summary": "20% workforce reduction in Q4 2025",
 *         "source": "https://techcrunch.com/..."
 *       }
 *     ]
 *   }]
 *
 * MAINTENANCE NOTES:
 *   - If you add new candidate sources, add them to SOURCES array
 *   - The ID matching must be exact (uses same generateId as other scripts)
 *   - Red flag types should match the schema in supabase-schema.sql
 *
 * @author Job Hunt Dashboard
 * @since 2026-01-18 (Token optimization update)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// === CONFIGURATION ===

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Candidate sources to update (must match filenames in candidates/ directory)
const SOURCES = ['linkedin', 'uiuxjobsboard', 'workinstartups', 'indeed', 'adzuna', 'reed'];

// === HELPER FUNCTIONS ===

/**
 * Parse command line arguments
 *
 * Supports:
 *   --results=path/to/file.json  (load research from file)
 *   --help                        (show usage)
 *
 * @returns {Object} - Parsed arguments { results: string }
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (const arg of args) {
    if (arg === '--help') {
      console.log(`
Usage:
  npm run merge:research -- --results=research-results.json
  echo '[{...}]' | npm run merge:research

Options:
  --results=FILE    Load research results from JSON file
  --help            Show this help message
      `);
      process.exit(0);
    }

    if (arg.startsWith('--results=')) {
      parsed.results = arg.split('=')[1];
    }
  }

  return parsed;
}

/**
 * Load research results from file or stdin
 *
 * Tries multiple sources in order:
 *   1. --results=file.json argument
 *   2. Standard input (for piping)
 *   3. Default location (candidates/research-results.json)
 *
 * @param {Object} args - Parsed command line arguments
 * @returns {Promise<Array>} - Array of research result objects
 * @throws {Error} - If no valid research results found
 */
async function loadResearchResults(args) {
  // Option 1: Load from --results=file.json
  if (args.results) {
    const filePath = path.isAbsolute(args.results)
      ? args.results
      : path.join(ROOT, args.results);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Research results file not found: ${filePath}`);
    }

    console.log(`Loading research from: ${filePath}`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(data) ? data : [data];
  }

  // Option 2: Read from stdin (for piping)
  // TODO: [MISSING] Implement stdin reading for piped research results
  // This would allow: echo '[{...}]' | npm run merge:research
  // For now, we require --results=file.json

  // Option 3: Check default location
  const defaultPath = path.join(ROOT, 'candidates', 'research-results.json');
  if (fs.existsSync(defaultPath)) {
    console.log(`Loading research from default location: ${defaultPath}`);
    const data = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
    return Array.isArray(data) ? data : [data];
  }

  throw new Error(
    'No research results found. Use --results=file.json or create candidates/research-results.json'
  );
}

/**
 * Load candidate file for a specific source
 *
 * @param {string} source - Source name (e.g., 'adzuna', 'reed')
 * @returns {Array|null} - Array of jobs or null if file doesn't exist
 */
function loadCandidateFile(source) {
  const file = path.join(ROOT, 'candidates', `${source}.json`);

  if (!fs.existsSync(file)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`  ❌ Failed to parse ${source}.json: ${e.message}`);
    return null;
  }
}

/**
 * Save candidate file for a specific source
 *
 * @param {string} source - Source name (e.g., 'adzuna', 'reed')
 * @param {Array} jobs - Array of jobs to save
 */
function saveCandidateFile(source, jobs) {
  const file = path.join(ROOT, 'candidates', `${source}.json`);
  fs.writeFileSync(file, JSON.stringify(jobs, null, 2));
}

/**
 * Merge research results into candidate jobs
 *
 * Updates candidate jobs with research findings:
 *   - directJobUrl: Verified URL to job listing (or null)
 *   - expired: Boolean indicating if job is still active
 *   - redFlags: Array of red flag objects
 *   - type: Changed to 'recruiter' if research found is_recruiter: true
 *
 * @param {Array} candidates - Original candidate jobs
 * @param {Array} research - Research results from AI agents
 * @returns {Object} - { updated: Array, stats: Object }
 */
function mergeResearch(candidates, research) {
  // Build lookup map for O(1) research result access
  const researchMap = new Map();
  for (const result of research) {
    if (result.id) {
      researchMap.set(result.id, result);
    }
  }

  const stats = {
    total: candidates.length,
    updated: 0,
    markAsRecruiter: 0,
    foundUrl: 0,
    foundRedFlags: 0,
    markedExpired: 0
  };

  const updated = candidates.map(job => {
    const researchResult = researchMap.get(job.id);

    // If no research for this job, return unchanged
    if (!researchResult) {
      return job;
    }

    stats.updated++;

    // Merge research fields
    const merged = { ...job };

    // Update direct job URL (verified or null)
    if (researchResult.direct_job_url !== undefined) {
      merged.directJobUrl = researchResult.direct_job_url;
      if (researchResult.direct_job_url) {
        stats.foundUrl++;
      }
    }

    // Update expired status
    if (researchResult.expired !== undefined) {
      merged.expired = researchResult.expired;
      if (researchResult.expired) {
        stats.markedExpired++;
      }
    }

    // Update red flags
    if (researchResult.red_flags !== undefined) {
      merged.redFlags = researchResult.red_flags;
      if (researchResult.red_flags.length > 0) {
        stats.foundRedFlags++;
      }
    }

    // Update type to recruiter if research found it's a recruiter
    if (researchResult.is_recruiter === true && job.type !== 'recruiter') {
      merged.type = 'recruiter';
      stats.markAsRecruiter++;
    }

    return merged;
  });

  return { updated, stats };
}

/**
 * Filter out expired jobs
 *
 * Expired jobs should not be synced to database (they're no longer active).
 * We keep them in the candidate files for historical tracking but exclude
 * them from the active job list.
 *
 * @param {Array} jobs - Jobs to filter
 * @returns {Object} - { active: Array, expired: Array }
 */
function filterExpired(jobs) {
  const active = [];
  const expired = [];

  for (const job of jobs) {
    if (job.expired === true) {
      expired.push(job);
    } else {
      active.push(job);
    }
  }

  return { active, expired };
}

// === MAIN EXECUTION ===

async function main() {
  console.log('\n=== MERGE RESEARCH RESULTS ===\n');

  // Step 1: Parse arguments and load research results
  const args = parseArgs();

  let research;
  try {
    research = await loadResearchResults(args);
    console.log(`Loaded ${research.length} research results\n`);
  } catch (error) {
    console.error(`❌ ${error.message}\n`);
    console.log('💡 TIP: Run this after company research is complete');
    console.log('   Save research results to candidates/research-results.json\n');
    process.exit(1);
  }

  if (research.length === 0) {
    console.log('ℹ️  No research results to merge.\n');
    return;
  }

  // Step 2: Load and update each candidate source
  console.log('Updating candidate files...\n');

  const allStats = {
    filesProcessed: 0,
    totalJobs: 0,
    totalUpdated: 0,
    totalExpired: 0,
    totalRecruiters: 0,
    totalUrls: 0,
    totalRedFlags: 0
  };

  for (const source of SOURCES) {
    const candidates = loadCandidateFile(source);

    if (!candidates) {
      continue; // Skip missing files
    }

    console.log(`  ${source}:`);
    console.log(`    Loaded: ${candidates.length} jobs`);

    // Merge research results
    const { updated, stats } = mergeResearch(candidates, research);

    if (stats.updated > 0) {
      // Save updated candidate file
      saveCandidateFile(source, updated);

      console.log(`    Updated: ${stats.updated} jobs`);
      console.log(`    - Found URLs: ${stats.foundUrl}`);
      console.log(`    - Marked as recruiter: ${stats.markAsRecruiter}`);
      console.log(`    - Found red flags: ${stats.foundRedFlags}`);
      console.log(`    - Marked expired: ${stats.markedExpired}`);

      // Aggregate stats
      allStats.filesProcessed++;
      allStats.totalJobs += stats.total;
      allStats.totalUpdated += stats.updated;
      allStats.totalExpired += stats.markedExpired;
      allStats.totalRecruiters += stats.markAsRecruiter;
      allStats.totalUrls += stats.foundUrl;
      allStats.totalRedFlags += stats.foundRedFlags;
    } else {
      console.log(`    No updates (no matching research results)`);
    }

    console.log('');
  }

  // Step 3: Summary
  console.log('=== SUMMARY ===\n');
  console.log(`Files processed: ${allStats.filesProcessed}`);
  console.log(`Total jobs: ${allStats.totalJobs}`);
  console.log(`Jobs updated: ${allStats.totalUpdated}`);
  console.log(`  - Direct URLs found: ${allStats.totalUrls}`);
  console.log(`  - Marked as recruiters: ${allStats.totalRecruiters}`);
  console.log(`  - Red flags found: ${allStats.totalRedFlags}`);
  console.log(`  - Marked expired: ${allStats.totalExpired}\n`);

  // Step 4: Next steps guidance
  console.log('🔜 NEXT STEPS:');
  if (allStats.totalExpired > 0) {
    console.log(`   Note: ${allStats.totalExpired} expired jobs will be excluded from sync`);
  }
  console.log('   Run npm run sync to add jobs to database\n');

  // TODO: [REFACTOR] Consider auto-running sync after merge if --auto flag is passed
  // This would allow: npm run merge:research -- --results=... --auto
  // For now, user must manually run sync as a separate step
}

// Execute with error handling
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
