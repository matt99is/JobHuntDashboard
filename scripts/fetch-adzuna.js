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
const MAX_JOB_AGE_DAYS = Number(process.env.JOB_MAX_AGE_DAYS || 30);
const MIN_SALARY = Number(process.env.JOB_MIN_SALARY || 50000);

// Generate consistent job ID
function generateId(job) {
  const norm = (s) => (s || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
  return `adzuna-${norm(job.company.display_name)}-${norm(job.title)}`;
}

// Calculate job age in days
function daysSince(dateString) {
  const posted = new Date(dateString);
  const now = new Date();
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

function toSalaryNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSalaryBounds(job) {
  const rawMin = toSalaryNumber(job.salary_min);
  const rawMax = toSalaryNumber(job.salary_max);

  if (Number.isFinite(rawMin) && Number.isFinite(rawMax)) {
    return {
      min: Math.min(rawMin, rawMax),
      max: Math.max(rawMin, rawMax),
    };
  }

  if (Number.isFinite(rawMin)) {
    return { min: rawMin, max: rawMin };
  }

  if (Number.isFinite(rawMax)) {
    return { min: rawMax, max: rawMax };
  }

  return { min: null, max: null };
}

function hasAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function isUiHeavyDescription(descLower) {
  const explicitUiHeavyPhrases = [
    'strong ui skills',
    'strong visual design',
    'visual-first',
    'visual first',
    'pixel perfect',
    'high fidelity ui',
    'ui-heavy',
    'ui heavy',
    'expert in ui',
    'advanced ui',
    'ui polish',
    'brand-led visual',
    'motion design',
    'animation-heavy',
    'illustration-heavy',
  ];

  if (hasAny(descLower, explicitUiHeavyPhrases)) return true;

  const uiSignals = [
    'visual design',
    'ui design',
    'high fidelity',
    'pixel perfect',
    'typography',
    'iconography',
    'brand guidelines',
    'after effects',
    'photoshop',
  ];
  const uxSignals = [
    'user research',
    'usability',
    'discovery',
    'interaction design',
    'journey',
    'information architecture',
    'prototype',
    'testing',
  ];

  const uiCount = uiSignals.filter((signal) => descLower.includes(signal)).length;
  const uxCount = uxSignals.filter((signal) => descLower.includes(signal)).length;
  return uiCount >= 3 && uxCount === 0;
}

// Check if job should be excluded
function shouldExclude(job, description) {
  const title = job.title.toLowerCase();
  const descLower = description.toLowerCase();
  const age = daysSince(job.created);
  const location = job.location.display_name.toLowerCase();

  // === STRICT LOCATION FILTERING ===
  // ONLY allow: Manchester area OR explicitly remote jobs
  const isManchester = location.includes('manchester') ||
                       location.includes('salford') ||
                       location.includes('stockport') ||
                       location.includes('bolton') ||
                       location.includes('oldham') ||
                       location.includes('rochdale') ||
                       location.includes('bury') ||
                       location.includes('wigan') ||
                       location.includes('trafford');

  const isRemote = job.location.area && job.location.area.includes('Remote');

  // Exclude if NOT Manchester area AND NOT remote
  if (!isManchester && !isRemote) {
    return 'wrong-location';
  }

  // If remote, verify it's UK remote (not overseas)
  if (isRemote && location.includes('overseas')) {
    return 'overseas-remote';
  }

  // Exclude if older than configured freshness window (default: 30 days)
  if (age > MAX_JOB_AGE_DAYS) return 'stale';

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

  // Exclude UI-heavy roles only when explicitly stated in the description.
  if (isUiHeavyDescription(descLower)) return 'ui-focus';

  // Exclude Senior Product Designer
  if (title.includes('senior') && title.includes('product designer')) return 'senior-pd';

  // Exclude gambling
  const gambling = ['bet365', 'flutter', 'entain', 'paddy power', 'betfair'];
  if (gambling.some(g => job.company.display_name.toLowerCase().includes(g))) {
    return 'gambling';
  }

  // Exclude jobs without a clear salary above configured minimum.
  const salary = getSalaryBounds(job);
  if (!Number.isFinite(salary.max) || salary.max <= MIN_SALARY) {
    return 'salary-below-threshold';
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
  const salary = getSalaryBounds(job);
  const salaryMax = Number.isFinite(salary.max) ? salary.max : 0;

  // Description-led interpretation across domain, method, and delivery context.
  if (hasAny(desc, ['e-commerce', 'ecommerce', 'retail', 'checkout', 'marketplace'])) score += 3;
  if (hasAny(desc, ['conversion', 'cro', 'funnel', 'a/b test', 'ab test', 'experimentation'])) score += 3;
  if (hasAny(desc, ['user research', 'usability testing', 'interview', 'discovery', 'journey mapping'])) score += 3;
  if (hasAny(desc, ['figma', 'prototype', 'wireframe', 'interaction design', 'information architecture'])) score += 2;
  if (hasAny(desc, ['design system', 'component library', 'accessibility', 'wcag'])) score += 2;
  if (hasAny(desc, ['b2b', 'saas', 'product thinking', 'outcomes', 'kpi', 'metrics'])) score += 2;
  if (hasAny(desc, ['cross-functional', 'stakeholder', 'partner with engineers', 'product manager', 'end-to-end'])) score += 2;
  if (hasAny(desc, ['gds', 'government digital service', 'service standard'])) score += 2;

  // Base fit for core target role families.
  if (title.includes('ux designer') || title.includes('product designer') || title.includes('interaction designer')) {
    score += 2;
  }

  // Seniority
  if (title.includes('senior') && title.includes('ux')) score += 3;
  else if (title.includes('mid')) score += 2;

  // Remote
  if (job.location.area && job.location.area.includes('Remote')) score += 2;

  // Salary
  if (salaryMax >= 80000) score += 3;
  else if (salaryMax >= 65000) score += 2;
  else if (salaryMax > MIN_SALARY) score += 1;

  // Freshness
  if (age <= MAX_JOB_AGE_DAYS) score += 2;

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
  if (age <= MAX_JOB_AGE_DAYS) return 'recent';
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
