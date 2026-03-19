/**
 * Applies a SQL migration file directly to PostgreSQL, bypassing Prisma's advisory lock.
 * Use when `prisma migrate dev` hangs due to lock contention.
 */
const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');

try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(l => {
    const [k, ...v] = l.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
} catch {}

const SQL_FILE = process.argv[2];
if (!SQL_FILE) { console.error('Usage: node apply-migration.js <path/to/migration.sql>'); process.exit(1); }

const sql = fs.readFileSync(SQL_FILE, 'utf8');

const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  console.log(`Applying: ${SQL_FILE}`);
  try {
    await client.query(sql);
    console.log('✅ Migration applied successfully!');
  } catch (e) {
    console.error('❌ Migration error:', e.message);
    process.exit(1);
  }
  await client.end();
}).catch(err => { console.error(err); process.exit(1); });
