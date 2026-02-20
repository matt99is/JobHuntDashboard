import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const QUEUE_FILE = path.join(ROOT, 'candidates', 'research-queue.json');
const OUTPUT_FILE = path.join(ROOT, 'candidates', 'research-results.json');

function runClaude(prompt, { model, maxTurns, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--model',
      model,
      '--permission-mode',
      'dontAsk',
      '--allowedTools',
      'Task,WebSearch,WebFetch',
      '--max-turns',
      String(maxTurns),
      prompt,
    ];

    const child = spawn('claude', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('NEEDS_INTERVENTION: Research step timed out.'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`NEEDS_INTERVENTION: Research command failed (${code}). ${stderr.trim()}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function extractJsonArray(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('NEEDS_INTERVENTION: Research output was not valid JSON array.');
  }

  const candidate = text.slice(start, end + 1);
  return JSON.parse(candidate);
}

function validateResults(results, expectedIds) {
  const valid = [];
  const expected = new Set(expectedIds);

  for (const result of results) {
    if (!result?.id || !expected.has(result.id)) {
      continue;
    }

    valid.push({
      id: result.id,
      company: result.company || null,
      is_recruiter: result.is_recruiter === true,
      direct_job_url: result.direct_job_url || null,
      expired: result.expired === true,
      red_flags: Array.isArray(result.red_flags) ? result.red_flags : [],
    });
  }

  if (valid.length === 0) {
    throw new Error('NEEDS_INTERVENTION: No valid research results were returned.');
  }

  return valid;
}

function buildPrompt(batch) {
  return `Research this list of jobs and return ONLY a JSON array.

Jobs:
${JSON.stringify(batch, null, 2)}

For each job id, return exactly:
{
  "id": "...",
  "company": "...",
  "is_recruiter": true|false,
  "direct_job_url": "https://..." or null,
  "expired": true|false,
  "red_flags": [
    {"type":"layoffs|glassdoor_low|financial|turnover|news_negative","severity":"high|medium|low","summary":"...","source":"https://..."}
  ]
}

Rules:
- Work in parallel using Task calls where possible.
- Verify direct job URLs before returning them.
- If you cannot verify a direct listing, return direct_job_url=null.
- Mark expired=true if role appears closed/unavailable.
- Only include red flags that are backed by evidence.
- Return strict JSON array only. No prose, no markdown.
`;
}

async function main() {
  console.log('\n=== CLAUDE RESEARCH ===\n');

  if (!fs.existsSync(QUEUE_FILE)) {
    throw new Error('NEEDS_INTERVENTION: Missing candidates/research-queue.json. Run filter step first.');
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  if (!Array.isArray(queue) || queue.length === 0) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify([], null, 2));
    console.log('No jobs need research.');
    return;
  }

  const batchSize = Number(process.env.CLAUDE_RESEARCH_BATCH_SIZE || 8);
  const model = process.env.CLAUDE_RESEARCH_MODEL || 'haiku';
  const maxTurns = Number(process.env.CLAUDE_RESEARCH_MAX_TURNS || 8);
  const timeoutMs = Number(process.env.CLAUDE_RESEARCH_TIMEOUT_MS || 35 * 60 * 1000);

  const results = [];

  for (let index = 0; index < queue.length; index += batchSize) {
    const batch = queue.slice(index, index + batchSize);
    console.log(`Researching batch ${Math.floor(index / batchSize) + 1}/${Math.ceil(queue.length / batchSize)} (${batch.length} jobs)...`);

    const output = await runClaude(buildPrompt(batch), { model, maxTurns, timeoutMs });
    const parsed = extractJsonArray(output);
    const validated = validateResults(parsed, batch.map((job) => job.id));

    results.push(...validated);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} research result(s) to ${OUTPUT_FILE}\n`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
