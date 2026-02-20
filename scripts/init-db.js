import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

async function main() {
  const schemaPath = path.join(ROOT, 'database', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Applying database/schema.sql...');
  await query(sql);
  console.log('Database schema is ready.');
}

main().catch((error) => {
  console.error('Schema apply failed:', error.message);
  process.exit(1);
});
