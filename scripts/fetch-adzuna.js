/**
 * Adzuna API Job Fetcher
 *
 * Fetches UX/Product Designer jobs from Adzuna API for Manchester/Remote UK
 *
 * Usage: node scripts/fetch-adzuna.js
 * Requires: ADZUNA_APP_ID and ADZUNA_APP_KEY in .env.local
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(ROOT, '.env.local') });

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
  console.error('Missing ADZUNA_APP_ID or ADZUNA_APP_KEY in .env.local');
  process.exit(1);
}

const SEARCH_QUERIES = [
  { what: 'ux designer', where: 'manchester' },
  { what: 'product designer', where: 'manchester' },
  { what: 'ux designer', where: 'uk' },
  { what: 'product designer', where: 'uk' }
];

// Generate consistent job ID
function generateId(job) {
  const norm = (s) => (s || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
  return `adzuna-${norm(job.company.display_name)}-${norm(job.title)}`;
}

// Calculate job age in days
function daysSince(dateString) {
  const posted = new Date(dateString);
  const now = new Date('2026-01-17');
  return Math.floor((now - posted) / (1000 * 60 * 60 * 24));
}

// Detect if company is a recruiter
function isRecruiter(company, description) {
  const recruiterKeywords = [
    'recruitment', 'recruiter', 'talent', 'staffing', 'personnel',
    'search', 'recruiting', 'headhunter', 'executive search',
    'zebra people', 'oliver bernard', 'hays', 'reed', 'michael page',
    'robert half', 'innova', 'jobgether', 'huzzle', 'maxwell bond',
    'gravitas', 'tenth revolution', 'adria', 'orbis', 'teksystems',
    'opus recruitment', 'page 1 recruitment', 'gios', 'embs', 'technet'
  ];

  const companyLower = company.toLowerCase();
  const descLower = description.toLowerCase();

  if (recruiterKeywords.some(k => companyLower.includes(k))) return true;
  if (descLower.includes('our client') || descLower.includes('on behalf of')) return true;

  return false;
}

// Check if job should be excluded
function shouldExclude(job, description) {
  const title = job.title.toLowerCase();
  const descLower = description.toLowerCase();
  const age = daysSince(job.created);

  // Exclude if >14 days old (stale)
  if (age > 14) return 'stale';

  // Exclude contract/freelance/part-time
  if (title.includes('contract') || title.includes('freelance') ||
      title.includes('part time') || title.includes('part-time') ||
      descLower.includes('freelance') || descLower.includes('contract') ||
      descLower.includes('part time') || descLower.includes('part-time')) {
    return 'contract';
  }

  // Exclude engineering/developer roles
  const engineeringKeywords = [
    'engineer', 'developer', 'dev ', ' dev', 'backend', 'frontend',
    'full stack', 'fullstack', 'software', 'python', 'java', '.net',
    'react ', 'angular', 'node', 'qa ', 'test', 'devops'
  ];
  if (engineeringKeywords.some(k => title.includes(k))) return 'engineering';

  // Exclude physical product design (CAD, manufacturing, etc)
  if (title.includes('cad') || title.includes('mechanical') ||
      title.includes('footwear') || title.includes('materials')) {
    return 'physical-product';
  }

  // Exclude product managers
  if (title.includes('product manager') || title.includes('product owner')) {
    return 'product-manager';
  }

  // Exclude sales/business roles
  const salesKeywords = ['sales', 'account manager', 'business development', 'bd '];
  if (salesKeywords.some(k => title.includes(k))) return 'sales';

  // Exclude Lead/Principal roles
  if (title.includes('lead') || title.includes('principal') || title.includes('head of')) {
    return 'lead';
  }

  // Exclude strong UI Designer emphasis
  if (title.startsWith('ui ') || title.startsWith('ui/ux')) return 'ui-focus';

  // Exclude Senior Product Designer
  if (title.includes('senior') && title.includes('product designer')) return 'senior-pd';

  // Exclude gambling
  const gambling = ['bet365', 'flutter', 'entain', 'paddy power', 'betfair'];
  if (gambling.some(g => job.company.display_name.toLowerCase().includes(g))) {
    return 'gambling';
  }

  // Exclude if salary below £50k (for any role)
  if (job.salary_min && job.salary_min < 50000) {
    return 'low-salary';
  }

  // Exclude service/digital/content designer
  if (title.includes('service designer') || title.includes('digital designer') ||
      title.includes('content designer')) {
    return 'wrong-designer-type';
  }

  // Must be a UX or Product Designer role
  const validTitles = ['ux designer', 'user experience designer', 'product designer',
                       'ux researcher', 'ux/ui designer', 'interaction designer'];
  const isValid = validTitles.some(vt => title.includes(vt));
  if (!isValid) return 'not-ux-product-designer';

  return null;
}

// Calculate suitability score
function calculateScore(job, description) {
  let score = 0;
  const title = job.title.toLowerCase();
  const desc = description.toLowerCase();
  const age = daysSince(job.created);

  // E-commerce, retail, conversion, figma, user research: +3 each
  if (desc.includes('e-commerce') || desc.includes('ecommerce') || desc.includes('retail')) score += 3;
  if (desc.includes('conversion') || desc.includes('cro')) score += 3;
  if (desc.includes('figma')) score += 3;
  if (desc.includes('user research') || desc.includes('user testing')) score += 3;

  // B2B, SaaS, design system, prototyping: +2 each
  if (desc.includes('b2b') || desc.includes('saas')) score += 2;
  if (desc.includes('design system')) score += 2;
  if (desc.includes('prototyp')) score += 2;

  // Seniority
  if (title.includes('senior') && title.includes('ux')) score += 3;
  else if (title.includes('mid')) score += 2;

  // Remote
  if (job.location.area && job.location.area.includes('Remote')) score += 2;

  // Salary
  if (job.salary_min) {
    if (job.salary_min >= 80000) score += 3;
    else if (job.salary_min >= 65000) score += 2;
    else if (job.salary_min >= 50000) score += 1;
  }

  // Freshness
  if (age < 14) score += 2;

  // UI/UX penalty
  if (title.includes('ui/ux') || title.includes('ui designer')) score -= 5;

  return Math.max(0, score);
}

// Determine seniority
function getSeniority(title) {
  const t = title.toLowerCase();
  if (t.includes('senior')) return 'senior';
  if (t.includes('junior')) return 'junior';
  if (t.includes('mid')) return 'mid';
  return 'mid';
}

// Determine role type
function getRoleType(title) {
  const t = title.toLowerCase();
  if (t.includes('product')) return 'product';
  return 'ux';
}

// Determine freshness
function getFreshness(age) {
  if (age < 7) return 'fresh';
  if (age < 14) return 'recent';
  return 'stale';
}

// Fetch jobs from Adzuna
async function fetchAdzuna(what, where) {
  const baseUrl = 'https://api.adzuna.com/v1/api/jobs/gb/search/1';
  const params = new URLSearchParams({
    app_id: ADZUNA_APP_ID,
    app_key: ADZUNA_APP_KEY,
    results_per_page: 50,
    what: what,
    where: where
  });

  const url = `${baseUrl}?${params}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Adzuna API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`Failed to fetch from Adzuna (${what} in ${where}):`, error.message);
    return [];
  }
}

// Main function
async function main() {
  console.log('\n=== ADZUNA API FETCH ===\n');

  let allJobs = [];

  // Fetch from all search queries
  for (const query of SEARCH_QUERIES) {
    console.log(`Searching: ${query.what} in ${query.where}...`);
    const jobs = await fetchAdzuna(query.what, query.where);
    console.log(`  Found: ${jobs.length} jobs`);
    allJobs = allJobs.concat(jobs);
  }

  console.log(`\nTotal raw results: ${allJobs.length}`);

  // Dedupe by URL
  const seen = new Map();
  for (const job of allJobs) {
    if (!seen.has(job.redirect_url)) {
      seen.set(job.redirect_url, job);
    }
  }
  const unique = Array.from(seen.values());
  console.log(`After dedupe: ${unique.length}\n`);

  // Process and filter
  const processed = [];
  let excluded = 0;

  for (const job of unique) {
    const description = job.description || '';
    const exclusionReason = shouldExclude(job, description);

    if (exclusionReason) {
      excluded++;
      continue;
    }

    const age = daysSince(job.created);
    const suitability = calculateScore(job, description);
    const type = isRecruiter(job.company.display_name, description) ? 'recruiter' : 'direct';

    processed.push({
      id: generateId(job),
      title: job.title,
      company: job.company.display_name,
      location: job.location.display_name,
      source: 'adzuna',
      type,
      url: job.redirect_url,
      remote: job.location.area ? job.location.area.includes('Remote') : false,
      salary: job.salary_min && job.salary_max ? `£${job.salary_min}-${job.salary_max}` : null,
      seniority: getSeniority(job.title),
      roleType: getRoleType(job.title),
      freshness: getFreshness(age),
      description: description.substring(0, 200),
      suitability,
      postedAt: job.created,
    });
  }

  console.log(`Excluded: ${excluded}`);
  console.log(`Processed: ${processed.length}\n`);

  // Sort by suitability
  processed.sort((a, b) => b.suitability - a.suitability);

  // Write to file
  const outputPath = path.join(ROOT, 'candidates', 'adzuna.json');
  fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));

  console.log(`Written to: ${outputPath}`);
  console.log(`\nTop 5 jobs:`);
  processed.slice(0, 5).forEach((j, i) => {
    console.log(`  ${i + 1}. ${j.title} at ${j.company} (${j.suitability})`);
  });
  console.log('');
}

main().catch(console.error);
