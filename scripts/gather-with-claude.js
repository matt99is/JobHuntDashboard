import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '@anthropic-ai/claude-agent-sdk';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CANDIDATES_DIR = path.join(ROOT, 'candidates');
dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config();
const SCORE_CUTOFF = Number(process.env.JOB_SCORE_CUTOFF || 12);
const MAX_JOB_AGE_DAYS = Number(process.env.JOB_MAX_AGE_DAYS || 30);
const MIN_SALARY = Number(process.env.JOB_MIN_SALARY || 50000);
const GMAIL_LABEL = process.env.GMAIL_JOB_LABEL || 'Jobs';
const GMAIL_LOOKBACK_DAYS = Number(process.env.GMAIL_JOB_LOOKBACK_DAYS || 7);

const OUTPUT_SOURCES = ['gmail'];

// Google Workspace MCP server — same config as Telegram bot (claude-agent.js)
const GOOGLE_WORKSPACE_MCP = {
  'google-workspace': {
    type: 'stdio',
    command: '/home/matt99is/.local/bin/uvx',
    args: ['workspace-mcp', '--single-user', '--tools', 'gmail'],
    env: {
      HOME: process.env.HOME || '/home/matt99is',
      PATH: process.env.PATH || '/home/matt99is/.local/bin:/usr/local/bin:/usr/bin:/bin',
      GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      USER_GOOGLE_EMAIL: process.env.USER_GOOGLE_EMAIL || 'mattlelonek@gmail.com',
    },
  },
};

// Read-only Gmail tools from workspace-mcp (mcp__google-workspace__ prefix).
// Explicitly listed so allowedTools can whitelist them while blocking
// filesystem tools (Read, Grep, Bash, etc.) that Claude misuses when unrestricted.
const GMAIL_ALLOWED_TOOLS = [
  'mcp__google-workspace__search_gmail_messages',
  'mcp__google-workspace__get_gmail_message_content',
  'mcp__google-workspace__list_gmail_labels',
];

function buildAllowedTools() {
  const envValue = process.env.CLAUDE_GATHER_ALLOWED_TOOLS;
  if (envValue && envValue.trim()) {
    return envValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return ['WebSearch', 'WebFetch', ...GMAIL_ALLOWED_TOOLS];
}

// ---------------------------------------------------------------------------
// Progress spinner — uses \r in TTY mode, plain lines when piped to a log file
// ---------------------------------------------------------------------------
class Spinner {
  constructor() {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.i = 0;
    this.interval = null;
    this.isTTY = process.stdout.isTTY === true;
    this.startTime = Date.now();
    this.turn = 0;
    this.lastAction = 'starting…';
  }

  start() {
    if (this.isTTY) {
      this.interval = setInterval(() => this._render(), 120);
    }
  }

  _elapsed() {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  _render() {
    const frame = this.frames[this.i++ % this.frames.length];
    process.stdout.write(
      `\r  ${frame} ${this._elapsed()}s  turn ${this.turn}  ${this.lastAction}`.padEnd(72)
    );
  }

  tool(name) {
    // Shorten verbose MCP prefixes for readability
    const short = name
      .replace('mcp__google-workspace__', 'gws:')
      .replace(/^mcp__\w+__/, 'mcp:');
    this.lastAction = short;
    if (!this.isTTY) {
      console.log(`  [${this._elapsed()}s] → ${short}`);
    }
  }

  nextTurn() {
    this.turn += 1;
    this.lastAction = 'thinking…';
    if (!this.isTTY) {
      console.log(`  [${this._elapsed()}s] turn ${this.turn}`);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.isTTY) {
      process.stdout.write('\r' + ' '.repeat(74) + '\r');
    }
  }
}

async function runClaude(prompt) {
  const model = process.env.CLAUDE_GATHER_MODEL || 'haiku';
  const maxTurns = Number(process.env.CLAUDE_GATHER_MAX_TURNS || '15');
  const timeoutMs = Number(process.env.CLAUDE_GATHER_TIMEOUT_MS || 3 * 60 * 1000);
  const allowedTools = buildAllowedTools();
  const allowedToolSet = new Set(allowedTools);

  const options = {
    model,
    maxTurns,
    allowedTools,
    permissionMode: 'acceptEdits',
    cwd: ROOT,
    mcpServers: GOOGLE_WORKSPACE_MCP,
    canUseTool: async (toolName, input) => (
      allowedToolSet.has(toolName)
        ? { behavior: 'allow', updatedInput: input }
        : { behavior: 'deny' }
    ),
  };

  let resultText = '';
  const spinner = new Spinner();

  const run = async () => {
    spinner.start();
    try {
      for await (const message of query({ prompt, options })) {
        if (message.type === 'assistant' && message.message?.content) {
          spinner.nextTurn();
          for (const block of message.message.content) {
            if (block.type === 'text' && block.text) {
              resultText += block.text;
            }
            if (block.type === 'tool_use') {
              spinner.tool(block.name);
            }
          }
        }
        if (message.type === 'result') {
          resultText = message.result || resultText;
        }
      }
    } finally {
      spinner.stop();
    }
    return resultText.trim();
  };

  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('NEEDS_INTERVENTION: Gather step timed out.')),
      timeoutMs
    );
  });

  try {
    return await Promise.race([run(), timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function extractJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('NEEDS_INTERVENTION: Gather output was not valid JSON.');
  }

  const candidate = text.slice(start, end + 1);
  return JSON.parse(candidate);
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
    if (days <= MAX_JOB_AGE_DAYS) return 'recent';
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
      if (days <= MAX_JOB_AGE_DAYS) return 'recent';
      return 'stale';
    }
  }

  return 'unknown';
}

function normalizeJob(source, raw) {
  const title = raw.title || '';
  const description = raw.description || '';
  const postedAt = raw.postedAt || null;

  return {
    title,
    company: raw.company,
    location: raw.location || null,
    source,
    type: normalizeApplicationType(raw.type, raw.company, description),
    url: raw.url || null,
    remote: Boolean(raw.remote),
    salary: raw.salary || null,
    seniority: normalizeSeniority(raw.seniority, title),
    roleType: normalizeRoleType(raw.roleType, title, description),
    freshness: normalizeFreshness(raw.freshness, postedAt),
    description,
    suitability: Number.isFinite(Number(raw.suitability)) ? Number(raw.suitability) : 0,
    postedAt,
  };
}

function saveSourceJobs(source, jobs) {
  const file = path.join(CANDIDATES_DIR, `${source}.json`);
  fs.writeFileSync(file, JSON.stringify(jobs, null, 2));
}

function buildPrompt() {
  const safeLookbackDays = Number.isFinite(GMAIL_LOOKBACK_DAYS) && GMAIL_LOOKBACK_DAYS > 0
    ? Math.floor(GMAIL_LOOKBACK_DAYS)
    : 7;

  return `You are running job intake for a UX/Product Designer job dashboard.

Run Gmail + web enrichment intake and return ONLY one JSON object with key:
gmail
The key must map to an array of jobs.

Tool rules:
- DO NOT use browser or playwright tools.
- DO NOT dispatch Task sub-agents.
- Use only WebSearch/WebFetch and Gmail MCP tools directly.

Gmail source requirements:
- Use Gmail label exactly "${GMAIL_LABEL}".
- Search scope is last ${safeLookbackDays} days only.
- Use Gmail MCP query equivalent to label + time window (for example: label:${GMAIL_LABEL} newer_than:${safeLookbackDays}d).
- Process all matching emails in that window (no arbitrary cap). Deduplicate candidate links from emails first.
- Gmail is discovery-only: every shortlisted role from email MUST be verified with WebFetch/WebSearch to retrieve full role description, salary, location, and remote details before scoring.
- Do not score or include roles based only on email snippets/subject lines.
- If a listing URL is a redirect/aggregator page, follow through with WebFetch/WebSearch to find the direct listing details where possible.
- If a source page is blocked, use WebSearch to recover the role details before deciding.

For EACH job, output fields:
{title, company, location, type, url, remote, salary, seniority, roleType, freshness, description, suitability, postedAt}

Hard filters:
- Keep ONLY Manchester-area or Remote UK roles.
- Exclude contract/freelance/part-time.
- Exclude lead/principal/head-of roles.
- Exclude strong UI-only focus roles ONLY when full description explicitly asks for strong visual/UI-heavy ownership (pixel-perfect visual craft, visual-first scope, etc.).
- Do NOT exclude UX/UI titles by title alone when UI-heavy requirements are not clearly stated.
- Exclude stale jobs older than ${MAX_JOB_AGE_DAYS} days.
- Exclude jobs with missing salary or salary <= £${MIN_SALARY}.

Scoring (intelligent interpretation of full description, not strict keyword matching):
- Domain/problem fit (ecommerce, conversion, customer journeys, measurable outcomes): +0 to +6
- Research and discovery depth (user research, usability, interviews, discovery): +0 to +5
- Product craft and delivery (IA, interaction design, prototyping, design systems, Figma): +0 to +5
- Product context and collaboration (B2B/SaaS, cross-functional ownership, PM/engineering partnership): +0 to +4
- Senior UX: +3, Mid UX: +2
- Remote UK: +2
- Salary: 80k+: +3, 65-79k: +2, >50k: +1

Cutoff:
- Drop any role scoring below ${SCORE_CUTOFF}.
- Return ONLY jobs with suitability >= ${SCORE_CUTOFF}.

Deduplication before output:
- Dedupe the gmail array by canonical URL first.
- If URL is missing, dedupe by normalized company + title + location.

Output rules:
- Return strict JSON only (no markdown, no prose).
- Ensure the gmail array exists even if empty.
- Include this diagnostics object:
  "_meta": {
    "gmail_checked": true|false,
    "gmail_messages_scanned": number,
    "gmail_tool_used": "google-workspace|gmail|none",
    "gmail_error": null|string,
    "gmail_label": "${GMAIL_LABEL}",
    "gmail_window_days": ${safeLookbackDays}
  }
`;
}

function isAuthIntervention(message) {
  return /GOOGLE_OAUTH_CLIENT_ID|GOOGLE_OAUTH_CLIENT_SECRET|authentication required|authorize/i.test(String(message || ''));
}

function buildFallbackPayload(errorMessage) {
  return {
    gmail: [],
    _meta: {
      gmail_checked: true,
      gmail_messages_scanned: 0,
      gmail_tool_used: 'google-workspace',
      gmail_error: `Fallback mode: ${errorMessage}`,
      gmail_label: GMAIL_LABEL,
      gmail_window_days: Number.isFinite(GMAIL_LOOKBACK_DAYS) ? GMAIL_LOOKBACK_DAYS : 7,
    },
  };
}

async function main() {
  console.log('\n=== CLAUDE GATHER (GMAIL + WEB ENRICHMENT) ===\n');

  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error(
      'NEEDS_INTERVENTION: GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET not set. Check .env.local.'
    );
  }

  // Prevent nested Claude Code sessions — SDK spawns a new `claude` process which fails if CLAUDECODE is set
  delete process.env.CLAUDECODE;

  fs.mkdirSync(CANDIDATES_DIR, { recursive: true });

  let output = '';
  let parsed = null;
  let gatherError = null;

  try {
    output = await runClaude(buildPrompt());
    parsed = extractJsonObject(output);
  } catch (error) {
    gatherError = error;
    try {
      console.warn('Gather output was not valid JSON. Retrying once with strict JSON-only instruction...');
      output = await runClaude(`${buildPrompt()}\n\nCRITICAL: Return only the final JSON object now. If intake fails, keep gmail as an empty array and explain in _meta.gmail_error.`);
      parsed = extractJsonObject(output);
      gatherError = null;
    } catch (retryError) {
      gatherError = retryError;
    }
  }

  if (!parsed) {
    const message = String(gatherError?.message || gatherError || 'Unknown gather failure');
    if (isAuthIntervention(message)) {
      throw gatherError instanceof Error ? gatherError : new Error(message);
    }
    console.warn(`Gather failed non-fatally; continuing with empty source payloads. Reason: ${message}`);
    parsed = buildFallbackPayload(message);
    output = JSON.stringify(parsed, null, 2);
  }

  fs.writeFileSync(path.join(CANDIDATES_DIR, 'gather-raw-output.txt'), output);
  const gmailRows = Array.isArray(parsed.gmail) ? parsed.gmail : [];
  const meta = parsed && typeof parsed === 'object' && parsed._meta && typeof parsed._meta === 'object'
    ? parsed._meta
    : {};

  const gmailChecked = meta.gmail_checked === true || gmailRows.length > 0;
  const gmailScanned = Number(meta.gmail_messages_scanned || 0);
  const gmailTool = String(meta.gmail_tool_used || 'none');
  const gmailError = meta.gmail_error ? String(meta.gmail_error) : null;

  console.log(`  gmail_checked: ${gmailChecked}`);
  console.log(`  gmail_messages_scanned: ${gmailScanned}`);
  console.log(`  gmail_tool_used: ${gmailTool}`);
  if (gmailError) {
    console.log(`  gmail_error: ${gmailError}`);
  }

  if (!gmailChecked && isAuthIntervention(gmailError)) {
    throw new Error(
      'NEEDS_INTERVENTION: Gmail email intake did not run. Check Google Workspace MCP credentials.'
    );
  }

  if (!gmailChecked) {
    console.warn('Gmail intake reported unchecked without auth error. Continuing in fallback mode.');
  }

  for (const source of OUTPUT_SOURCES) {
    const rows = Array.isArray(parsed[source]) ? parsed[source] : [];
    const normalized = rows
      .map((row) => normalizeJob(source, row))
      .filter((job) => job.title && job.company && (job.suitability || 0) >= SCORE_CUTOFF);

    saveSourceJobs(source, normalized);
    console.log(`  ${source}: ${normalized.length} jobs`);
  }

  console.log('\nClaude gather complete.\n');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
