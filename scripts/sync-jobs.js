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
const SOURCES = ['gmail', 'adzuna'];
const MIN_SALARY = Number(process.env.JOB_MIN_SALARY || 50000);

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

function extractSalaryBounds(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { min: value, max: value } : null;
  }

  const text = String(value).toLowerCase().replace(/,/g, '');
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(k)?/g)];
  if (matches.length === 0) return null;

  const numbers = matches
    .map(([, raw, k]) => {
      const num = Number(raw);
      if (!Number.isFinite(num)) return null;
      return k ? num * 1000 : num;
    })
    .filter((num) => Number.isFinite(num) && num > 0);

  if (numbers.length === 0) return null;
  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
  };
}

function normalizeDedupeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCompanyForDedupe(company) {
  return normalizeDedupeText(company).replace(/\b(ltd|limited|llp|inc|corp|co|plc)\b/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeTitleForDedupe(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function descriptionFingerprint(description) {
  return normalizeDedupeText(description).slice(0, 120);
}

function canonicalizeUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(String(url));
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '');
    return `${host}${path}`;
  } catch {
    return null;
  }
}

function sourceCompanyTitleKey(job) {
  const sourceKey = normalizeDedupeText(job.source);
  const companyKey = normalizeCompanyForDedupe(job.company);
  const titleKey = normalizeTitleForDedupe(job.title);
  return `sct:${sourceKey}|${companyKey}|${titleKey}`;
}

function companyTitleKey(job) {
  const companyKey = normalizeCompanyForDedupe(job.company);
  const titleKey = normalizeTitleForDedupe(job.title);
  return `ct:${companyKey}|${titleKey}`;
}

function buildDedupeKeys(job) {
  const keys = [];
  const canonicalUrl = canonicalizeUrl(job.url);
  if (canonicalUrl) {
    keys.push(`url:${canonicalUrl}`);
  }

  keys.push(sourceCompanyTitleKey(job));
  keys.push(companyTitleKey(job));

  const companyKey = normalizeCompanyForDedupe(job.company);
  const titleKey = normalizeTitleForDedupe(job.title);
  const salaryKey = extractSalaryBounds(job.salary)?.max ?? '';
  const descKey = descriptionFingerprint(job.description);
  keys.push(`content:${companyKey}|${titleKey}|${salaryKey}|${descKey}`);

  return keys;
}

function normalizeSourceTag(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function mergeSourceTags(...values) {
  const tags = new Set(values.flatMap((value) => normalizeSourceTag(value)));
  if (tags.size === 0) return null;
  return [...tags].sort().join(',');
}

// Dedupe by canonical URL and fuzzy content key (keep highest score / freshest).
function dedupe(jobs) {
  const sorted = [...jobs].sort((a, b) => {
    const bySuitability = Number(b.suitability || 0) - Number(a.suitability || 0);
    if (bySuitability !== 0) return bySuitability;
    const byPosted = new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime();
    return byPosted;
  });

  const keyOwners = new Map();
  const deduped = [];

  for (const job of sorted) {
    const keys = buildDedupeKeys(job);
    const owner = keys.find((key) => keyOwners.has(key));
    if (owner) {
      const winnerIndex = keyOwners.get(owner);
      deduped[winnerIndex].source = mergeSourceTags(deduped[winnerIndex].source, job.source);
      continue;
    }

    const normalized = {
      ...job,
      source: mergeSourceTags(job.source),
    };
    const index = deduped.push(normalized) - 1;
    keys.forEach((key) => keyOwners.set(key, index));
  }

  return deduped;
}

function normalizeApplicationType(rawType, company = '', description = '') {
  const text = `${rawType || ''} ${company || ''} ${description || ''}`.toLowerCase();
  const recruiterSignals = [
    'recruiter',
    'recruitment',
    'agency',
    'staffing',
    'talent partner',
    'headhunter',
  ];
  return recruiterSignals.some((signal) => text.includes(signal)) ? 'recruiter' : 'direct';
}

function normalizeSeniority(rawSeniority, title = '') {
  const text = `${rawSeniority || ''} ${title || ''}`.toLowerCase();
  if (text.includes('lead') || text.includes('principal') || text.includes('head')) return 'lead';
  if (text.includes('senior') || text.includes('sr')) return 'senior';
  if (text.includes('junior') || text.includes('entry')) return 'junior';
  return 'mid';
}

function normalizeRoleType(rawRoleType, title = '', description = '') {
  const text = `${rawRoleType || ''} ${title || ''} ${description || ''}`.toLowerCase();
  return text.includes('product') ? 'product' : 'ux';
}

function normalizeFreshness(rawFreshness, postedAt) {
  const fromPostedAt = (() => {
    if (!postedAt) return null;
    const posted = new Date(postedAt);
    if (Number.isNaN(posted.getTime())) return null;
    const days = Math.floor((Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return null;
    if (days < 7) return 'fresh';
    if (days <= 30) return 'recent';
    return 'stale';
  })();
  if (fromPostedAt) return fromPostedAt;

  const text = String(rawFreshness || '').toLowerCase();
  if (!text) return 'unknown';
  if (text.includes('fresh')) return 'fresh';
  if (text.includes('recent')) return 'recent';
  if (text.includes('stale')) return 'stale';

  const dayMatch = text.match(/(\d+)\s*day/);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    if (Number.isFinite(days)) {
      if (days < 7) return 'fresh';
      if (days <= 30) return 'recent';
      return 'stale';
    }
  }

  return 'unknown';
}

// Global suitability cutoff (scores below this are never synced to dashboard).
const SCORE_CUTOFF = Number(process.env.JOB_SCORE_CUTOFF || 12);

// Map to database schema
function toDbRow(job) {
  const suitability = job.suitability || 0;
  // Check both old (directUrl) and new (directJobUrl) field names for compatibility
  const directUrl = job.directJobUrl || job.directUrl || null;
  const hasResearch = directUrl !== null || job.redFlags !== undefined;
  const title = job.title || '';
  const description = job.description || '';

  return {
    id: job.id,
    title,
    company: job.company,
    location: job.location || null,
    url: job.url || null,
    salary: job.salary || null,
    remote: job.remote || false,
    seniority: normalizeSeniority(job.seniority, title),
    role_type: normalizeRoleType(job.roleType, title, description),
    application_type: normalizeApplicationType(job.type, job.company, description),
    freshness: normalizeFreshness(job.freshness, job.postedAt),
    description: description || null,
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
    const existingResult = await query('SELECT id, source, title, company, url, salary, description FROM jobs');
    existing = existingResult.rows;
  } catch (error) {
    console.error('Failed to fetch existing jobs:', error.message);
    return;
  }

  const existingIds = new Set(existing.map(j => j.id));
  const existingKeys = new Set();
  for (const row of existing) {
    for (const key of buildDedupeKeys(row)) {
      existingKeys.add(key);
    }
  }

  // Filter new jobs
  const newJobs = unique.filter(j => {
    return !existingIds.has(j.id) && !buildDedupeKeys(j).some((key) => existingKeys.has(key));
  });

  // Filter out expired jobs (marked during research phase)
  const activeJobs = newJobs.filter((j) => j.expired !== true);
  const expiredCount = newJobs.length - activeJobs.length;

  if (expiredCount > 0) {
    console.log(`Filtered out ${expiredCount} expired jobs\n`);
  }

  const salaryEligibleJobs = activeJobs.filter((j) => {
    const bounds = extractSalaryBounds(j.salary);
    return bounds && Number.isFinite(bounds.max) && bounds.max > MIN_SALARY;
  });
  const droppedLowOrUnknownSalary = activeJobs.length - salaryEligibleJobs.length;

  if (droppedLowOrUnknownSalary > 0) {
    console.log(`Filtered out ${droppedLowOrUnknownSalary} jobs without salary above £${MIN_SALARY.toLocaleString()}\n`);
  }

  // Enforce minimum suitability cutoff before insertion.
  const cutoffJobs = salaryEligibleJobs.filter((j) => Number(j.suitability || 0) >= SCORE_CUTOFF);
  const droppedLowScore = salaryEligibleJobs.length - cutoffJobs.length;

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
