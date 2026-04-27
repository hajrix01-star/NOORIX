import { extractJson } from './extract-json.util';

describe('extractJson', () => {
  it('returns null for empty input', () => {
    expect(extractJson('')).toBeNull();
    expect(extractJson('   ')).toBeNull();
  });

  it('strips UTF-8 BOM before parsing', () => {
    const bom = '\uFEFF';
    const out = extractJson<{ a: number }>(`${bom}{ "a": 1 }`);
    expect(out).toEqual({ a: 1 });
  });

  it('extracts JSON from fenced markdown block', () => {
    const text = 'Here is data:\n```json\n{ "x": "y" }\n```\ntrailing';
    expect(extractJson(text)).toEqual({ x: 'y' });
  });

  it('parses first balanced object when extra text wraps it', () => {
    const text = 'prefix { "k": true } suffix';
    expect(extractJson(text)).toEqual({ k: true });
  });

  it('parses whole string when it is raw JSON', () => {
    expect(extractJson('["a","b"]')).toEqual(['a', 'b']);
  });

  it('returns null when no valid JSON', () => {
    expect(extractJson('not json { broken')).toBeNull();
  });
});
