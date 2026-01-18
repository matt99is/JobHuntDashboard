/**
 * Reed API Job Fetcher
 *
 * Fetches UX/Product Designer jobs from Reed.co.uk API for Manchester/Remote UK
 *
 * Usage: node scripts/fetch-reed.js
 * Requires: REED_API_KEY in .env.local
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(ROOT, '.env.local') });

const REED_API_KEY = process.env.REED_API_KEY;

if (!REED_API_KEY) {
  console.error('Missing REED_API_KEY in .env.local');
  process.exit(1);
}

const SEARCH_QUERIES = [
  { keywords: 'ux designer', locationName: 'Manchester' },
  { keywords: 'product designer', locationName: 'Manchester' },
  { keywords: 'ux designer', locationName: 'Remote' },
  { keywords: 'product designer', locationName: 'Remote' }
];

// Generate consistent job ID
function generateId(job) {
  const norm = (s) => (s || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
  return `reed-${norm(job.employerName)}-${norm(job.jobTitle)}`;
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
  const descLower = (description || '').toLowerCase();

  if (recruiterKeywords.some(k => companyLower.includes(k))) return true;
  if (descLower.includes('our client') || descLower.includes('on behalf of')) return true;

  return false;
}

// Check if job should be excluded
function shouldExclude(job, description) {
  const title = job.jobTitle.toLowerCase();
  const descLower = (description || '').toLowerCase();
  const age = daysSince(job.date);

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
  if (gambling.some(g => job.employerName.toLowerCase().includes(g))) {
    return 'gambling';
  }

  // Exclude if salary below £50k (for any role)
  if (job.minimumSalary && job.minimumSalary < 50000) {
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
  const title = job.jobTitle.toLowerCase();
  const desc = (description || '').toLowerCase();
  const age = daysSince(job.date);

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
  if (job.locationName && job.locationName.toLowerCase().includes('remote')) score += 2;

  // Salary
  if (job.minimumSalary) {
    if (job.minimumSalary >= 80000) score += 3;
    else if (job.minimumSalary >= 65000) score += 2;
    else if (job.minimumSalary >= 50000) score += 1;
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

// Fetch jobs from Reed
async function fetchReed(keywords, locationName) {
  const baseUrl = 'https://www.reed.co.uk/api/1.0/search';
  const params = new URLSearchParams({
    keywords,
    locationName,
    distanceFromLocation: 30,
    resultsToTake: 100
  });

  const url = `${baseUrl}?${params}`;

  // Create Basic Auth header (API key as username, empty password)
  const auth = Buffer.from(`${REED_API_KEY}:`).toString('base64');

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Reed API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`Failed to fetch from Reed (${keywords} in ${locationName}):`, error.message);
    return [];
  }
}

// Fetch job details from Reed
async function fetchJobDetails(jobId) {
  const url = `https://www.reed.co.uk/api/1.0/jobs/${jobId}`;
  const auth = Buffer.from(`${REED_API_KEY}:`).toString('base64');

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch job details ${jobId}:`, error.message);
    return null;
  }
}

// Main function
async function main() {
  console.log('\n=== REED API FETCH ===\n');

  let allJobs = [];

  // Fetch from all search queries
  for (const query of SEARCH_QUERIES) {
    console.log(`Searching: ${query.keywords} in ${query.locationName}...`);
    const jobs = await fetchReed(query.keywords, query.locationName);
    console.log(`  Found: ${jobs.length} jobs`);
    allJobs = allJobs.concat(jobs);
  }

  console.log(`\nTotal raw results: ${allJobs.length}`);

  // Dedupe by jobId
  const seen = new Map();
  for (const job of allJobs) {
    if (!seen.has(job.jobId)) {
      seen.set(job.jobId, job);
    }
  }
  const unique = Array.from(seen.values());
  console.log(`After dedupe: ${unique.length}\n`);

  // Process and filter
  const processed = [];
  let excluded = 0;

  console.log('Fetching job details...');
  for (let i = 0; i < unique.length; i++) {
    const job = unique[i];

    // Show progress
    if ((i + 1) % 10 === 0) {
      console.log(`  Processed ${i + 1}/${unique.length}...`);
    }

    // Fetch full job details
    const details = await fetchJobDetails(job.jobId);
    if (!details) {
      excluded++;
      continue;
    }

    const description = details.jobDescription || '';
    const exclusionReason = shouldExclude(job, description);

    if (exclusionReason) {
      excluded++;
      continue;
    }

    const age = daysSince(job.date);
    const suitability = calculateScore(job, description);
    const type = isRecruiter(job.employerName, description) ? 'recruiter' : 'direct';

    const salary = job.minimumSalary && job.maximumSalary
      ? `£${job.minimumSalary}-${job.maximumSalary}`
      : null;

    processed.push({
      id: generateId(job),
      title: job.jobTitle,
      company: job.employerName,
      location: job.locationName,
      source: 'reed',
      type,
      url: job.jobUrl,
      remote: job.locationName ? job.locationName.toLowerCase().includes('remote') : false,
      salary,
      seniority: getSeniority(job.jobTitle),
      roleType: getRoleType(job.jobTitle),
      freshness: getFreshness(age),
      description: description.substring(0, 200),
      suitability,
      postedAt: job.date,
    });

    // Rate limit: small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\nExcluded: ${excluded}`);
  console.log(`Processed: ${processed.length}\n`);

  // Sort by suitability
  processed.sort((a, b) => b.suitability - a.suitability);

  // Write to file
  const outputPath = path.join(ROOT, 'candidates', 'reed.json');
  fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2));

  console.log(`Written to: ${outputPath}`);
  console.log(`\nTop 5 jobs:`);
  processed.slice(0, 5).forEach((j, i) => {
    console.log(`  ${i + 1}. ${j.title} at ${j.company} (${j.suitability})`);
  });
  console.log('');
}

main().catch(console.error);
