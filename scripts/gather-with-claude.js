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

const OUTPUT_SOURCES = ['linkedin', 'uiuxjobsboard', 'workinstartups', 'indeed'];

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
  'mcp__google-workspace__get_gmail_messages_content_batch',
  'mcp__google-workspace__get_gmail_attachment_content',
  'mcp__google-workspace__get_gmail_thread_content',
  'mcp__google-workspace__get_gmail_threads_content_batch',
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
  const timeoutMs = Number(process.env.CLAUDE_GATHER_TIMEOUT_MS || 25 * 60 * 1000);
  const allowedTools = buildAllowedTools();

  const options = {
    model,
    maxTurns,
    allowedTools,
    permissionMode: 'acceptEdits',
    cwd: ROOT,
    mcpServers: GOOGLE_WORKSPACE_MCP,
    canUseTool: async (_toolName, input) => ({ behavior: 'allow', updatedInput: input }),
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

  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('NEEDS_INTERVENTION: Gather step timed out.')),
      timeoutMs
    )
  );

  return Promise.race([run(), timeout]);
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

function normalizeJob(source, raw) {
  return {
    title: raw.title,
    company: raw.company,
    location: raw.location || null,
    source,
    type: raw.type || 'direct',
    url: raw.url || null,
    remote: Boolean(raw.remote),
    salary: raw.salary || null,
    seniority: raw.seniority || 'mid',
    roleType: raw.roleType || (String(raw.title || '').toLowerCase().includes('product') ? 'product' : 'ux'),
    freshness: raw.freshness || 'unknown',
    description: raw.description || '',
    suitability: Number.isFinite(Number(raw.suitability)) ? Number(raw.suitability) : 0,
    postedAt: raw.postedAt || null,
  };
}

function saveSourceJobs(source, jobs) {
  const file = path.join(CANDIDATES_DIR, `${source}.json`);
  fs.writeFileSync(file, JSON.stringify(jobs, null, 2));
}

function buildPrompt() {
  return `You are running job intake for a UX/Product Designer job dashboard.

Run web + email intake in parallel and return ONLY one JSON object with keys:
linkedin, uiuxjobsboard, workinstartups, indeed.
Each key must map to an array of jobs.

Tool rules:
- DO NOT use browser or playwright tools.
- DO NOT dispatch Task sub-agents.
- Use only WebSearch/WebFetch and Gmail MCP tools directly.

Use tools in parallel where possible:
- LinkedIn/email alerts: use Gmail MCP tools for recent LinkedIn job alerts (last 7 days), open relevant messages, extract job listing links and details.
- UIUXJobsBoard: fetch current UK remote listings.
- WorkInStartups: fetch design jobs.
- Indeed UK: fetch UX/product designer listings; if blocked or unavailable return an empty array for indeed.

For EACH job, output fields:
{title, company, location, type, url, remote, salary, seniority, roleType, freshness, description, suitability, postedAt}

Hard filters:
- Keep ONLY Manchester-area or Remote UK roles.
- Exclude contract/freelance/part-time.
- Exclude lead/principal/head-of roles.
- Exclude strong UI-only focus roles.
- Exclude stale jobs older than 14 days.

Scoring:
- ecommerce/retail/user research/conversion/figma: +3 each
- b2b/saas/prototyping/design system: +2 each
- Senior UX: +3, Mid UX: +2
- Remote: +2
- 80k+: +3, 65-79k: +2, 50-64k: +1
- UI/UX or UI-designer emphasis: -5

Cutoff:
- Drop any role scoring below ${SCORE_CUTOFF}.
- Return ONLY jobs with suitability >= ${SCORE_CUTOFF}.

Output rules:
- Return strict JSON only (no markdown, no prose).
- Ensure every array exists even if empty.
- Include this diagnostics object:
  "_meta": {
    "gmail_checked": true|false,
    "gmail_messages_scanned": number,
    "gmail_tool_used": "google-workspace|gmail|none",
    "gmail_error": null|string
  }
`;
}

async function main() {
  console.log('\n=== CLAUDE GATHER (EMAIL + WEB) ===\n');

  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new Error(
      'NEEDS_INTERVENTION: GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET not set. Check .env.local.'
    );
  }

  fs.mkdirSync(CANDIDATES_DIR, { recursive: true });

  const output = await runClaude(buildPrompt());
  fs.writeFileSync(path.join(CANDIDATES_DIR, 'gather-raw-output.txt'), output);
  const parsed = extractJsonObject(output);
  const linkedinRows = Array.isArray(parsed.linkedin) ? parsed.linkedin : [];
  const meta = parsed && typeof parsed === 'object' && parsed._meta && typeof parsed._meta === 'object'
    ? parsed._meta
    : {};

  const gmailChecked = meta.gmail_checked === true || linkedinRows.length > 0;
  const gmailScanned = Number(meta.gmail_messages_scanned || 0);
  const gmailTool = String(meta.gmail_tool_used || 'none');
  const gmailError = meta.gmail_error ? String(meta.gmail_error) : null;

  console.log(`  gmail_checked: ${gmailChecked}`);
  console.log(`  gmail_messages_scanned: ${gmailScanned}`);
  console.log(`  gmail_tool_used: ${gmailTool}`);
  if (gmailError) {
    console.log(`  gmail_error: ${gmailError}`);
  }

  if (!gmailChecked) {
    throw new Error(
      'NEEDS_INTERVENTION: Gmail email intake did not run. Check Google Workspace MCP credentials.'
    );
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
