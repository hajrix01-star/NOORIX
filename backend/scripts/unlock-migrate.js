/**
 * Releases the Prisma advisory lock by terminating the holding backend.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  env.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
} catch {}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Find the lock holder
  const locks = await client.query(`
    SELECT pid, granted FROM pg_locks
    WHERE locktype = 'advisory' AND classid = 0 AND objid = 72707369 AND granted = true;
  `);

  for (const row of locks.rows) {
    console.log(`Terminating backend PID ${row.pid}...`);
    const result = await client.query(`SELECT pg_terminate_backend($1)`, [row.pid]);
    console.log('Terminated:', result.rows[0]);
  }

  // Verify
  const remaining = await client.query(`
    SELECT pid, granted FROM pg_locks
    WHERE locktype = 'advisory' AND classid = 0 AND objid = 72707369;
  `);
  console.log('Remaining locks after termination:', remaining.rows);
  await client.end();
}

main().catch(console.error);
