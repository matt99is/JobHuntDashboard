import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load local-first env so scripts and server share the same config behavior.
dotenv.config({ path: path.join(ROOT, '.env.local') });
dotenv.config();

function resolveDatabaseUrl() {
  // Prefer explicit DB_* values from .env.local for reliability.
  // This avoids stale shell-level DATABASE_URL values overriding local config.
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '5432';
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (host && user && database) {
    const encodedPassword = password ? encodeURIComponent(password) : '';
    const auth = encodedPassword ? `${encodeURIComponent(user)}:${encodedPassword}` : encodeURIComponent(user);
    return `postgresql://${auth}@${host}:${port}/${database}`;
  }

  // Fallback to raw URL only when DB_* values are not configured.
  const fromUrl = process.env.DATABASE_URL;
  if (fromUrl) return fromUrl;

  return null;
}

const connectionString = resolveDatabaseUrl();

if (!connectionString) {
  throw new Error(
    'Missing DATABASE_URL (or DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME) in environment.'
  );
}

const sslEnabled = String(process.env.DB_SSL || '').toLowerCase() === 'true';

export const pool = new Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  allowExitOnIdle: true,
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}
