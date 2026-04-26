/**
 * سكربت مؤقت: يبني أجسام الخدمات من hr.service.ts (لمرة واحدة)
 * npm exec node src/hr/split-hr-services.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, 'hr.service.ts');
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

const slice0 = (a, b) => lines.slice(a, b + 1).join('\n');

// payroll: run queries + adv + (skip date/sync 172–197) + payroll through advance invoices + movements/allow/ded
const payrollBody = [
  slice0(50, 171),
  slice0(230, 916), // 231–917: كامل findAdvance (كان ينقص })
  slice0(1819, 1961), // 1820–1962: حركات + بدل + خصم (دون } إغلاق class السطر 1963)
].join('\n\n');

// leave: sync+maybe (198–230) + all leave up to returnFromLeave (920–1623)
const leaveBody = [slice0(197, 229), slice0(918, 1623)].join('\n\n');

// residency: 1626–1722 (بعد returnFromLeave، دون بداية DOCUMENTS)
const resBody = slice0(1625, 1721);
// documents: 1724–1818
const docBody = slice0(1723, 1817);

const out = path.join(__dirname, '_gen');
if (!fs.existsSync(out)) fs.mkdirSync(out);
fs.writeFileSync(path.join(out, 'hr-payroll.body.txt'), payrollBody, 'utf8');
fs.writeFileSync(path.join(out, 'hr-leave.body.txt'), leaveBody, 'utf8');
fs.writeFileSync(path.join(out, 'hr-res.body.txt'), resBody, 'utf8');
fs.writeFileSync(path.join(out, 'hr-doc.body.txt'), docBody, 'utf8');
console.log('Wrote', out);
