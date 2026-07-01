import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getText } from './index';

const translationsDir = path.dirname(fileURLToPath(import.meta.url));
const translationFiles = fs
  .readdirSync(translationsDir)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => path.join(translationsDir, file));

const MOJIBAKE_RE =
  /(?:\u0637[\u0080-\u00ff]|\u0638[\u0080-\u00ff\u02c6\u201a-\u201e\u2020-\u2022]|\u00d8[\u0080-\u00ff]|\u00d9[\u0080-\u00ff]|\u00e2[\u0080-\uffff]|\ufffd)/;

describe('translations', () => {
  it('keeps Arabic translations as valid UTF-8 at the source', () => {
    expect(getText('selectVault', 'ar')).toBe('اختر الخزنة');
    expect(getText('invoiceVaultColumn', 'ar')).toBe('الخزنة');
    expect(getText('expenseCoverageSection', 'ar')).toBe('فترة التغطية للدفعة');
  });

  it('keeps English translations unchanged', () => {
    expect(getText('selectVault', 'en')).toBe('Select vault');
  });

  it('rejects mojibake in translation source files', () => {
    const offenders = translationFiles.flatMap((file) => {
      const rel = path.relative(process.cwd(), file);
      return fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .flatMap((line, index) => (MOJIBAKE_RE.test(line) ? [`${rel}:${index + 1}`] : []));
    });

    expect(offenders).toEqual([]);
  });
});
