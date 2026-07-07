import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const failures = [];

const protectedCompatibilityFiles = new Set([
  'src/types/api/http.ts',
  'src/services/core/apiHttp.ts',
  'src/hooks/useApiMutation.ts',
  'src/hooks/useApiQuery.ts',
]);

const maxLooseApiResultSignatures = 0;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(dir, predicate, acc = []) {
  for (const entry of fs.readdirSync(path.join(root, dir))) {
    const rel = path.join(dir, entry).replaceAll('\\', '/');
    const abs = path.join(root, rel);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      if (!['node_modules', 'dist', 'build', '.git'].includes(entry)) walk(rel, predicate, acc);
    } else if (predicate(rel)) {
      acc.push(rel);
    }
  }
  return acc;
}

function fail(message) {
  failures.push(message);
}

for (const rel of protectedCompatibilityFiles) {
  if (!exists(rel)) fail(`${rel}: protected API compatibility boundary is missing.`);
}

const register = read('docs/SECTION_UNIFICATION_REGISTER.md');
for (const required of [
  '## API Contracts Finalization',
  '`check:api-contracts-governance`',
  'Loose API response signatures baseline: 0',
  'src/hooks/useApiMutation.ts',
]) {
  if (!register.includes(required)) {
    fail(`docs/SECTION_UNIFICATION_REGISTER.md: missing API contracts governance note: ${required}`);
  }
}

const sourceFiles = walk('src', (file) => /\.(ts|tsx)$/.test(file));
let looseApiResultSignatures = 0;
for (const file of sourceFiles) {
  const source = read(file);
  const matches = source.match(/Promise<ApiParsedResult>(?!<)/g);
  if (matches) looseApiResultSignatures += matches.length;

  if (!protectedCompatibilityFiles.has(file)) {
    if (/ApiParsedResult<[^>\n]*\bany\b[^>\n]*>/.test(source)) {
      fail(`${file}: ApiParsedResult<any> is not allowed outside protected API compatibility boundaries.`);
    }
    if (/useMutation<any\b/.test(source)) {
      fail(`${file}: useMutation<any> is not allowed outside protected API compatibility boundaries.`);
    }
  }
}

if (looseApiResultSignatures > maxLooseApiResultSignatures) {
  fail(
    `Loose API response signatures increased to ${looseApiResultSignatures}; baseline is ${maxLooseApiResultSignatures}. Tighten endpoints or update the register with a deliberate closure decision.`,
  );
}

if (failures.length) {
  console.error('API contracts governance failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`API contracts governance passed. Loose API response signatures: ${looseApiResultSignatures}/${maxLooseApiResultSignatures}.`);
