import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { notifyRunEvent } from './lib/notify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const RUNS_DIR = path.join(ROOT, 'runs');

// Load local env so manual runs (npm run pipeline:run) include notifications/config.
dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config();
const SCORE_CUTOFF = Number(process.env.JOB_SCORE_CUTOFF || 12);

function runCommand(command, args, { cwd, logFile }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    const startedAt = Date.now();

    let stdout = '';
    let stderr = '';

    const log = (line) => {
      fs.appendFileSync(logFile, line);
    };

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
      log(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
      log(text);
    });

    child.on('error', (error) => reject(error));

    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function loadJsonCount(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

async function runStep(runState, name, command, args) {
  const logFile = path.join(runState.runDir, `${name}.log`);
  const step = {
    name,
    status: 'running',
    startedAt: new Date().toISOString(),
    logFile,
  };
  runState.steps.push(step);

  fs.writeFileSync(path.join(runState.runDir, 'run.json'), JSON.stringify(runState, null, 2));

  const result = await runCommand(command, args, { cwd: ROOT, logFile });
  step.finishedAt = new Date().toISOString();
  step.durationMs = result.durationMs;
  step.code = result.code;

  if (result.code !== 0) {
    step.status = 'failed';
    step.error = result.stderr.trim() || result.stdout.trim() || `Command failed with code ${result.code}`;
    fs.writeFileSync(path.join(runState.runDir, 'run.json'), JSON.stringify(runState, null, 2));
    throw new Error(step.error);
  }

  step.status = 'success';
  fs.writeFileSync(path.join(runState.runDir, 'run.json'), JSON.stringify(runState, null, 2));
  return result;
}

async function main() {
  fs.mkdirSync(RUNS_DIR, { recursive: true });

  const runId = nowStamp();
  const runDir = path.join(RUNS_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const runState = {
    runId,
    startedAt: new Date().toISOString(),
    status: 'running',
    runDir,
    cutoffScore: SCORE_CUTOFF,
    schedule: 'weekly_monday_0700_gmt',
    steps: [],
  };

  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(runState, null, 2));

  await notifyRunEvent({
    title: 'Job pipeline started',
    body: `Run ${runId} started. Collecting and researching jobs now.`,
    severity: 'info',
    eventType: 'pipeline_started',
    metadata: { run_id: runId },
  });

  try {
    console.log('\n=== WEEKLY AI PIPELINE RUN ===\n');

    // Phase 1: deterministic API fetch (parallel)
    await Promise.all([
      runStep(runState, 'fetch-adzuna', 'npm', ['run', 'fetch:adzuna']),
    ]);

    // Phase 2: AI gathering from Gmail label alerts (with web enrichment)
    await runStep(runState, 'gather-with-claude', 'node', ['scripts/gather-with-claude.js']);

    // Phase 3: dedupe/filter with configured score cutoff
    await runStep(runState, 'filter-new', 'npm', ['run', 'filter:new']);

    // Phase 4: AI research for all jobs >= score cutoff
    await runStep(runState, 'research-with-claude', 'node', ['scripts/research-with-claude.js']);

    // Phase 5: merge and sync to local database
    await runStep(runState, 'merge-research', 'npm', ['run', 'merge:research', '--', '--results=candidates/research-results.json']);
    const syncResult = await runStep(runState, 'sync', 'npm', ['run', 'sync']);

    const queueCount = loadJsonCount(path.join(ROOT, 'candidates', 'research-queue.json'));
    const researchedCount = loadJsonCount(path.join(ROOT, 'candidates', 'research-results.json'));

    const insertedMatch = syncResult.stdout.match(/Inserted\s+(\d+)\s+jobs/i);
    const insertedCount = insertedMatch ? Number(insertedMatch[1]) : 0;

    runState.finishedAt = new Date().toISOString();
    runState.status = 'success';
    runState.summary = {
      researchQueue: queueCount,
      researched: researchedCount,
      inserted: insertedCount,
      droppedBelowCutoff: `Enforced for score < ${SCORE_CUTOFF} during gather/filter/sync steps`,
    };

    fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(runState, null, 2));

    await notifyRunEvent({
      title: 'Job pipeline completed',
      body: `Run ${runId} finished. Researched ${researchedCount} jobs, synced ${insertedCount} new roles.`,
      severity: 'success',
      eventType: 'pipeline_success',
      metadata: {
        run_id: runId,
        researched: researchedCount,
        inserted: insertedCount,
      },
    });
  } catch (error) {
    runState.finishedAt = new Date().toISOString();
    runState.status = 'failed';
    runState.error = error.message;

    fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(runState, null, 2));

    const needsIntervention = /NEEDS_INTERVENTION/i.test(String(error.message || ''));

    await notifyRunEvent({
      title: needsIntervention ? 'Job pipeline needs intervention' : 'Job pipeline failed',
      body: `Run ${runId} failed at ${runState.steps.at(-1)?.name || 'unknown step'}. Error: ${error.message}`,
      severity: needsIntervention ? 'warning' : 'error',
      eventType: needsIntervention ? 'pipeline_attention_needed' : 'pipeline_failed',
      metadata: {
        run_id: runId,
        step: runState.steps.at(-1)?.name || 'unknown',
      },
    });

    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
