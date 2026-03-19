const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '..', '.env');
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((l) => {
    const [k, ...v] = l.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
} catch {}

const sql = `
  DROP POLICY IF EXISTS tenant_isolation_select ON users;
  CREATE POLICY tenant_isolation_select ON users
  FOR SELECT TO PUBLIC
  USING (
    tenant_id = current_tenant_id()
    OR (current_tenant_id() IS NULL OR current_tenant_id() = '')
  );
`;

const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query(sql))
  .then(() => { console.log('OK'); client.end(); })
  .catch((e) => { console.error(e); client.end(); process.exit(1); });
