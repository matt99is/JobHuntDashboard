/**
 * Job Search - Sync to Local PostgreSQL
 *
 * Merges candidate files from agents, deduplicates, and inserts new jobs.
 *
 * Usage: npm run sync
 * Requires: DATABASE_URL or DB_* values in .env.local
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SOURCES = ['linkedin', 'uiuxjobsboard', 'workinstartups', 'indeed', 'adzuna'];

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

// Global suitability cutoff (scores below this are never synced to dashboard).
const SCORE_CUTOFF = Number(process.env.JOB_SCORE_CUTOFF || 12);

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
    research_status: hasResearch ? 'complete' : (suitability >= SCORE_CUTOFF ? 'pending' : 'skipped'),
    researched_at: hasResearch ? new Date().toISOString() : null,
  };
}

// Mark jobs older than 30 days as stale (based on posted_at, fallback to created_at)
async function deprecateOldJobs() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();

  let postedCount = 0;
  let createdCount = 0;

  try {
    const postedResult = await query(
      `
      UPDATE jobs
      SET freshness = 'stale'
      WHERE posted_at < $1
        AND freshness IS DISTINCT FROM 'stale'
      `,
      [cutoff]
    );
    postedCount = postedResult.rowCount || 0;
  } catch (error) {
    console.error('Deprecate (posted_at) failed:', error.message);
  }

  try {
    const createdResult = await query(
      `
      UPDATE jobs
      SET freshness = 'stale'
      WHERE posted_at IS NULL
        AND created_at < $1
        AND freshness IS DISTINCT FROM 'stale'
      `,
      [cutoff]
    );
    createdCount = createdResult.rowCount || 0;
  } catch (error) {
    console.error('Deprecate (created_at) failed:', error.message);
  }

  return postedCount + createdCount;
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

  // Fetch existing from local database
  console.log('Checking existing jobs...');
  let existing = [];
  try {
    const existingResult = await query('SELECT id, title, company FROM jobs');
    existing = existingResult.rows;
  } catch (error) {
    console.error('Failed to fetch existing jobs:', error.message);
    return;
  }

  const existingIds = new Set(existing.map(j => j.id));
  const existingKeys = new Set(existing.map(j => `${j.company?.toLowerCase()}-${j.title?.toLowerCase()}`));

  // Filter new jobs
  const newJobs = unique.filter(j => {
    const key = `${j.company?.toLowerCase()}-${j.title?.toLowerCase()}`;
    return !existingIds.has(j.id) && !existingKeys.has(key);
  });

  // Filter out expired jobs (marked during research phase)
  const activeJobs = newJobs.filter((j) => j.expired !== true);
  const expiredCount = newJobs.length - activeJobs.length;

  if (expiredCount > 0) {
    console.log(`Filtered out ${expiredCount} expired jobs\n`);
  }

  // Enforce minimum suitability cutoff before insertion.
  const cutoffJobs = activeJobs.filter((j) => Number(j.suitability || 0) >= SCORE_CUTOFF);
  const droppedLowScore = activeJobs.length - cutoffJobs.length;

  if (droppedLowScore > 0) {
    console.log(`Filtered out ${droppedLowScore} jobs below score cutoff (${SCORE_CUTOFF})\n`);
  }

  console.log(`Existing: ${existing.length}, New: ${cutoffJobs.length}\n`);

  if (cutoffJobs.length === 0) {
    console.log('No new jobs to add.\n');
    return;
  }

  // Sort by suitability and insert
  cutoffJobs.sort((a, b) => b.suitability - a.suitability);
  const rows = cutoffJobs.map(toDbRow);

  console.log('Inserting...');
  let inserted = 0;

  try {
    for (const row of rows) {
      const result = await query(
        `
        INSERT INTO jobs (
          id, title, company, location, url, salary, remote, seniority, role_type,
          application_type, freshness, description, source, status, suitability,
          posted_at, career_page_url, red_flags, research_status, researched_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20
        )
        ON CONFLICT (id) DO NOTHING
        `,
        [
          row.id,
          row.title,
          row.company,
          row.location,
          row.url,
          row.salary,
          row.remote,
          row.seniority,
          row.role_type,
          row.application_type,
          row.freshness,
          row.description,
          row.source,
          row.status,
          row.suitability,
          row.posted_at,
          row.career_page_url,
          JSON.stringify(row.red_flags || []),
          row.research_status,
          row.researched_at,
        ]
      );
      inserted += result.rowCount || 0;
    }
  } catch (error) {
    console.error('Insert failed:', error.message);
    const fallback = path.join(ROOT, 'candidates', 'failed-import.json');
    fs.writeFileSync(fallback, JSON.stringify(cutoffJobs, null, 2));
    console.log(`Fallback written to ${fallback}`);
    return;
  }

  console.log(`\nInserted ${inserted} jobs\n`);

  // Show top 5
  console.log('Top opportunities:');
  cutoffJobs.slice(0, 5).forEach((j, i) => {
    console.log(`  ${i + 1}. ${j.title} at ${j.company} (${j.suitability})`);
  });
  console.log('');
}

main().catch(console.error);
