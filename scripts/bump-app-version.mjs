import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = resolve(__dirname, '../src/constants/appVersion.ts');
const source = readFileSync(target, 'utf8');
const next = source.replace(
  /APP_VERSION_NUMBER\s*=\s*(\d+)/,
  (_match, value) => `APP_VERSION_NUMBER = ${Number(value) + 1}`,
);

if (next === source) {
  throw new Error('APP_VERSION_NUMBER not found');
}

writeFileSync(target, next);
console.log(next.match(/APP_VERSION_NUMBER\s*=\s*(\d+)/)?.[0] ?? 'version bumped');
