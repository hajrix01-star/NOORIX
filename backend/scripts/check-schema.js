const { Client } = require('pg');
const fs = require('fs'), path = require('path');
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(l => {
    const [k, ...v] = l.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
} catch {}

const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  const r = await c.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id' ORDER BY table_name");
  console.log('Tables WITH tenant_id:', r.rows.map(x => x.table_name).join(', '));
  const t = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name");
  console.log('All tables:', t.rows.map(x => x.table_name).join(', '));
  const inv = await c.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='invoices' ORDER BY ordinal_position");
  console.log('Invoices columns:', JSON.stringify(inv.rows));
  await c.end();
}).catch(console.error);
