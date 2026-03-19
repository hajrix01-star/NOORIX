const { PrismaClient } = require('@prisma/client');
require('fs').readFileSync(require('path').join(__dirname, '../.env'), 'utf8')
  .split('\n').forEach(l => {
    const [k, ...v] = l.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });

const p = new PrismaClient();

async function main() {
  const rls = await p.$queryRaw`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname='public' AND rowsecurity=true
    ORDER BY tablename
  `;
  console.log('\n=== جداول مفعّل عليها RLS ===');
  console.table(rls.map(r => ({ table: r.tablename })));

  const noRls = await p.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname='public' AND rowsecurity=false
    ORDER BY tablename
  `;
  console.log('\n=== جداول بدون RLS ===');
  console.table(noRls.map(r => ({ table: r.tablename })));
}

main().catch(console.error).finally(() => p.$disconnect());
