import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(process.cwd(), 'src');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);
const MOJIBAKE_RE =
  /(?:\u00d8[\u0080-\u00ff]|\u00d9[\u0080-\u00ff]|\u00e2[\u0080-\uffff]|\u0637[\u00a1-\u00ae\u00b1\u00b6-\u00ba]|\u0638[\u0080-\u00ba\u02c6\u201a-\u201e\u2020-\u2022])/;

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return sourceExtensions.has(path.extname(entry.name)) ? [fullPath] : [];
  });
}

describe('source encoding', () => {
  it('keeps source files as valid UTF-8 without mojibake', () => {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const offenders: string[] = [];

    for (const file of listSourceFiles(sourceRoot)) {
      const rel = path.relative(process.cwd(), file);
      let text = '';
      try {
        text = decoder.decode(fs.readFileSync(file));
      } catch {
        offenders.push(`${rel}: invalid UTF-8`);
        continue;
      }

      text.split(/\r?\n/).forEach((line, index) => {
        if (line.includes('\uFFFD') || MOJIBAKE_RE.test(line)) {
          offenders.push(`${rel}:${index + 1}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
