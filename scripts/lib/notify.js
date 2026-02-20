import { spawn } from 'child_process';
import fs from 'fs';

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Command failed with exit code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

export async function notifyRunEvent({
  title,
  body,
  severity = 'info',
  eventType = 'pipeline_update',
  metadata = {},
}) {
  const script = process.env.SYSTEM_NOTIFY_SCRIPT;
  if (!script || !fs.existsSync(script)) {
    console.log(`[notify-skip] ${title} :: ${body}`);
    return;
  }

  const args = [
    script,
    '--project',
    process.env.SYSTEM_NOTIFY_PROJECT || 'job-hunt-dashboard',
    '--event-type',
    eventType,
    '--severity',
    severity,
    '--title',
    title,
    '--body',
    body,
  ];

  for (const [key, value] of Object.entries(metadata || {})) {
    args.push('--metadata', `${key}=${value}`);
  }

  try {
    await runCommand('python3', args);
  } catch (error) {
    console.warn('[notify-error]', error.message);
  }
}
