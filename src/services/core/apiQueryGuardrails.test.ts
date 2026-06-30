import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOTS = ['src/modules', 'src/services', 'src/hooks', 'src/components'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const ALLOWED_RAW_USE_QUERY_FILES = new Set([
  'src/hooks/useApiQuery.ts',
]);
const ALLOWED_RAW_USE_MUTATION_FILES = new Set([
  'src/hooks/useApiMutation.ts',
]);
const ALLOWED_DIRECT_FETCH_FILES = new Set([
  // Central HTTP client.
  'src/services/core/apiHttp.ts',
  // Version probes and binary/download flows are intentionally outside JSON API hooks.
  'src/utils/deployVersionGuard.ts',
  'src/services/domains/apiEndpoints/backup.ts',
  'src/services/domains/apiEndpoints/connection-bank.ts',
]);
const ALLOWED_EMPTY_LIST_CATCHES = new Set([
  // Local draft snapshots only; this is not official API/backend data.
  'src/modules/Reports/costAccountingAppsSavedSlots.ts',
]);
const LEGACY_API_ASSERTION_NAMES = new RegExp(`\\b(?:${'reject' + 'IfApiFailed'}|${'assert' + 'ApiOk'})\\b`);

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'dist-esm') continue;
      out.push(...walkFiles(path));
      continue;
    }
    if (!SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf('.')))) continue;
    if (/\.(test|spec)\.tsx?$/.test(path)) continue;
    out.push(path);
  }
  return out;
}

function scanSource(pattern: RegExp): string[] {
  return SOURCE_ROOTS.flatMap((root) => walkFiles(join(process.cwd(), root)))
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(process.cwd(), file).replace(/\\/g, '/'));
}

describe('API query handling guardrails', () => {
  it('keeps module reads on centralized API query hooks', () => {
    expect(scanSource(/\buseQuer(?:y|ies)\s*\(/)
      .filter((file) => !ALLOWED_RAW_USE_QUERY_FILES.has(file))).toEqual([]);
  });

  it('keeps module commands on centralized API mutation hooks', () => {
    expect(scanSource(/\buseMutation\s*\(/)
      .filter((file) => !ALLOWED_RAW_USE_MUTATION_FILES.has(file))).toEqual([]);
  });

  it('keeps raw fetch behind the approved API/download/probe wrappers', () => {
    expect(scanSource(/\bfetch\s*\(/)
      .filter((file) => !ALLOWED_DIRECT_FETCH_FILES.has(file))).toEqual([]);
  });

  it('does not hide official data failures as empty lists', () => {
    expect(scanSource(/catch\s*(?:\([^)]*\))?\s*\{\s*return\s+\[\s*\]\s*;?\s*\}/s)
      .filter((file) => !ALLOWED_EMPTY_LIST_CATCHES.has(file))).toEqual([]);
  });

  it('keeps API command failures on the core throwIfApiFailed path', () => {
    expect(scanSource(LEGACY_API_ASSERTION_NAMES)).toEqual([]);
  });
});
