import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];

const approvedFooterPrimitives = ['DialogActions', 'PayrollRunActions', 'FileTrigger'];
const scanRoots = ['src/components', 'src/modules', 'src/ui'];

function abs(rel) {
  return path.join(root, rel);
}

function read(rel) {
  return fs.existsSync(abs(rel)) ? fs.readFileSync(abs(rel), 'utf8') : '';
}

function fail(rel, message) {
  failures.push(`${rel}: ${message}`);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile() && /\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function readBalanced(source, openIndex, openChar, closeChar) {
  let depth = 0;
  let quote = '';
  let escaped = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const prev = source[index - 1] || '';

    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote && quote !== '`') quote = '';
      else if (quote === '`' && char === '`' && prev !== '\\') quote = '';
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === openChar) depth += 1;
    if (char === closeChar) depth -= 1;
    if (depth === 0) return source.slice(openIndex, index + 1);
  }

  return source.slice(openIndex);
}

function expressionAfter(source, valueIndex) {
  const tail = source.slice(valueIndex);
  const rest = tail.trimStart();
  const offset = valueIndex + tail.length - rest.length;
  if (rest.startsWith('{')) return readBalanced(source, offset, '{', '}');
  if (rest.startsWith('(')) return readBalanced(source, offset, '(', ')');
  return rest.split(/\r?\n/)[0] || '';
}

function footerExpressions(source) {
  const expressions = [];
  for (const re of [/\bfooter\s*=\s*/g, /\bconst\s+footer\s*=\s*/g]) {
    let match;
    while ((match = re.exec(source))) {
      const valueIndex = match.index + match[0].length;
      expressions.push({ index: match.index, expression: expressionAfter(source, valueIndex) });
    }
  }
  return expressions;
}

function validateFooterExpression(rel, source, index, expression) {
  if (!/<\s*Button\b/.test(expression)) return;
  const hasApprovedPrimitive = approvedFooterPrimitives.some((name) => new RegExp(`<\\s*${name}\\b`).test(expression));
  if (hasApprovedPrimitive) return;
  fail(rel, `line ${lineOf(source, index)} footer actions must use DialogActions or an approved central primitive instead of raw Button elements.`);
}

for (const scanRoot of scanRoots) {
  for (const file of walk(abs(scanRoot))) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const source = fs.readFileSync(file, 'utf8');
    for (const item of footerExpressions(source)) {
      validateFooterExpression(rel, source, item.index, item.expression);
    }
  }
}

const packageJson = read('package.json');
if (!packageJson.includes('"check:dialog-actions-governance": "node scripts/check-dialog-actions-governance.mjs"')) {
  fail('package.json', 'missing check:dialog-actions-governance script.');
}

const consolidated = read('scripts/check-system-governance-consolidated.mjs');
if (!consolidated.includes("'check-dialog-actions-governance.mjs'")) {
  fail('scripts/check-system-governance-consolidated.mjs', 'dialog actions governance must be part of the system-governance umbrella.');
}

const interactionPlan = read('docs/NOORIX_INTERACTION_SYSTEM_PLAN.md');
for (const required of ['DialogActions', 'check:dialog-actions-governance', 'Central dialog action footers']) {
  if (!interactionPlan.includes(required)) fail('docs/NOORIX_INTERACTION_SYSTEM_PLAN.md', `missing interaction governance note: ${required}`);
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const required of ['## Dialog Actions Governance', '`check:dialog-actions-governance`', 'DialogActions']) {
  if (!register.includes(required)) fail('docs/SECTION_UNIFICATION_REGISTER.md', `missing dialog actions register note: ${required}`);
}

if (failures.length) {
  console.error('Dialog actions governance failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Dialog actions governance passed.');
