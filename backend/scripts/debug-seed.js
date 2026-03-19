const { PrismaClient } = require('@prisma/client');
const fs = require('fs'), path = require('path');
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n').forEach(l => {
    const [k, ...v] = l.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
  });
} catch {}
const prisma = new PrismaClient();
prisma.employee.findMany().then(e => {
  console.log('Employees:', e);
  return prisma.account.findMany({ where: { code: 'EMP-001' } });
}).then(a => {
  console.log('EMP-001 accounts:', a);
  return prisma.company.findMany({ select: { id: true, nameAr: true, tenantId: true } });
}).then(c => {
  console.log('Companies:', c);
}).finally(() => prisma.$disconnect());
