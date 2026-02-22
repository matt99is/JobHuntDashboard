import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { query, withTransaction } from '../lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config();

const app = express();

function resolveDashboardScoreCutoff() {
  const value = process.env.DASHBOARD_SCORE_CUTOFF ?? process.env.JOB_SCORE_CUTOFF ?? '12';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 12;
}

const port = Number(process.env.API_PORT || process.env.PORT || 8788);
const dashboardScoreCutoff = resolveDashboardScoreCutoff();
const frontendOrigins = (process.env.FRONTEND_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigins.includes('*') || frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '2mb' }));

function applyStatusRules(status, extras = {}) {
  const updates = { status };

  if (status === 'applied') {
    updates.status = 'awaiting';
    updates.applied_at = new Date().toISOString();
  }

  if (status === 'interview' && extras.interview_date) {
    updates.interview_date = extras.interview_date;
  }

  if (['offer', 'rejected', 'ghosted'].includes(status || '')) {
    updates.outcome_at = new Date().toISOString();
    if (extras.outcome_notes) {
      updates.outcome_notes = extras.outcome_notes;
    }
  }

  return updates;
}

function normalizeJob(job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location ?? null,
    url: job.url ?? null,
    salary: job.salary ?? null,
    remote: Boolean(job.remote),
    seniority: job.seniority ?? null,
    role_type: job.role_type ?? null,
    application_type: job.application_type ?? null,
    freshness: job.freshness ?? 'unknown',
    description: job.description ?? null,
    source: job.source ?? null,
    status: job.status ?? 'new',
    suitability: Number.isFinite(Number(job.suitability)) ? Number(job.suitability) : 0,
    posted_at: job.posted_at ?? null,
    career_page_url: job.career_page_url ?? null,
    red_flags: Array.isArray(job.red_flags) ? job.red_flags : [],
    research_status: job.research_status ?? 'pending',
    researched_at: job.researched_at ?? null,
    applied_at: job.applied_at ?? null,
    interview_date: job.interview_date ?? null,
    outcome_at: job.outcome_at ?? null,
    outcome_notes: job.outcome_notes ?? null,
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

function extractSalaryMax(salary) {
  if (salary === null || salary === undefined) return null;
  if (typeof salary === 'number') return Number.isFinite(salary) ? salary : null;
  const matches = [...String(salary).toLowerCase().replace(/,/g, '').matchAll(/(\d+(?:\.\d+)?)\s*(k)?/g)];
  if (matches.length === 0) return null;
  const values = matches
    .map(([, raw, k]) => {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return null;
      return k ? parsed * 1000 : parsed;
    })
    .filter((n) => Number.isFinite(n) && n > 0);
  if (values.length === 0) return null;
  return Math.max(...values);
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

function dedupeActiveJobs(rows) {
  const sorted = [...rows].sort((a, b) => {
    const bySuitability = Number(b.suitability || 0) - Number(a.suitability || 0);
    if (bySuitability !== 0) return bySuitability;
    const byCreated = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    return byCreated;
  });

  const keyOwners = new Map();
  const deduped = [];

  for (const row of sorted) {
    const keys = [];
    const canonicalUrl = canonicalizeUrl(row.url);
    if (canonicalUrl) {
      keys.push(`url:${canonicalUrl}`);
    }

    keys.push(sourceCompanyTitleKey(row));
    keys.push(companyTitleKey(row));

    const companyKey = normalizeCompanyForDedupe(row.company);
    const titleKey = normalizeTitleForDedupe(row.title);
    const salaryKey = extractSalaryMax(row.salary) ?? '';
    const descKey = descriptionFingerprint(row.description);
    keys.push(`content:${companyKey}|${titleKey}|${salaryKey}|${descKey}`);

    const owner = keys.find((key) => keyOwners.has(key));
    if (owner) {
      const winnerIndex = keyOwners.get(owner);
      deduped[winnerIndex].source = mergeSourceTags(deduped[winnerIndex].source, row.source);
      continue;
    }

    const normalized = {
      ...row,
      source: mergeSourceTags(row.source),
    };
    const index = deduped.push(normalized) - 1;
    keys.forEach((key) => keyOwners.set(key, index));
  }

  return deduped;
}

app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true, time: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/jobs', async (_req, res) => {
  try {
    const { rows } = await query(
      `
      SELECT *
      FROM jobs
      WHERE status IS DISTINCT FROM 'rejected'
        AND status IS DISTINCT FROM 'ghosted'
        AND COALESCE(suitability, 0) >= $1
      ORDER BY suitability DESC, created_at DESC
      `,
      [dashboardScoreCutoff]
    );
    res.json(dedupeActiveJobs(rows));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/jobs/archived', async (_req, res) => {
  try {
    const { rows } = await query(
      `
      SELECT *
      FROM jobs
      WHERE status IN ('offer', 'rejected', 'ghosted')
      ORDER BY outcome_at DESC NULLS LAST, updated_at DESC
      `
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/jobs/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, extras } = req.body || {};

  if (status === undefined) {
    res.status(400).json({ error: 'Missing status in request body.' });
    return;
  }

  const updates = applyStatusRules(status, extras);
  const updateColumns = Object.keys(updates);

  if (updateColumns.length === 0) {
    res.status(400).json({ error: 'No fields to update.' });
    return;
  }

  const assignments = updateColumns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  const values = updateColumns.map((column) => updates[column]);
  values.push(id);

  try {
    const { rows } = await query(
      `UPDATE jobs SET ${assignments} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Job not found.' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await query(
      `
      UPDATE jobs
      SET status = 'rejected', outcome_at = now()
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Job not found.' });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs/upsert', async (req, res) => {
  const jobs = Array.isArray(req.body?.jobs) ? req.body.jobs : null;

  if (!jobs) {
    res.status(400).json({ error: 'Request body must include jobs array.' });
    return;
  }

  const rows = jobs.map(normalizeJob);

  try {
    await withTransaction(async (client) => {
      for (const row of rows) {
        await client.query(
          `
          INSERT INTO jobs (
            id, title, company, location, url, salary, remote,
            seniority, role_type, application_type, freshness,
            description, source, status, suitability, posted_at,
            career_page_url, red_flags, research_status, researched_at,
            applied_at, interview_date, outcome_at, outcome_notes
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,
            $12,$13,$14,$15,$16,
            $17,$18,$19,$20,
            $21,$22,$23,$24
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            company = EXCLUDED.company,
            location = EXCLUDED.location,
            url = EXCLUDED.url,
            salary = EXCLUDED.salary,
            remote = EXCLUDED.remote,
            seniority = EXCLUDED.seniority,
            role_type = EXCLUDED.role_type,
            application_type = EXCLUDED.application_type,
            freshness = EXCLUDED.freshness,
            description = EXCLUDED.description,
            source = EXCLUDED.source,
            status = EXCLUDED.status,
            suitability = EXCLUDED.suitability,
            posted_at = EXCLUDED.posted_at,
            career_page_url = EXCLUDED.career_page_url,
            red_flags = EXCLUDED.red_flags,
            research_status = EXCLUDED.research_status,
            researched_at = EXCLUDED.researched_at,
            applied_at = EXCLUDED.applied_at,
            interview_date = EXCLUDED.interview_date,
            outcome_at = EXCLUDED.outcome_at,
            outcome_notes = EXCLUDED.outcome_notes
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
            JSON.stringify(row.red_flags),
            row.research_status,
            row.researched_at,
            row.applied_at,
            row.interview_date,
            row.outcome_at,
            row.outcome_notes,
          ]
        );
      }
    });

    res.json({ ok: true, count: rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Local API listening on http://localhost:${port}`);
});
