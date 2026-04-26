import { describe, it, expect } from 'vitest';
import { normalizeColumnDefs } from './exportNormalize';

describe('normalizeColumnDefs', () => {
  it('treats string[] as both labels and keys', () => {
    const { labels, keys } = normalizeColumnDefs(['a', 'b']);
    expect(labels).toEqual(['a', 'b']);
    expect(keys).toEqual(['a', 'b']);
  });

  it('maps { key, label } objects', () => {
    const { labels, keys } = normalizeColumnDefs([
      { key: 'id', label: 'المعرّف' },
      { key: 'name', label: 'الاسم' },
    ]);
    expect(keys).toEqual(['id', 'name']);
    expect(labels).toEqual(['المعرّف', 'الاسم']);
  });

  it('returns empty for null/empty', () => {
    expect(normalizeColumnDefs(null)).toEqual({ labels: [], keys: [] });
    expect(normalizeColumnDefs([])).toEqual({ labels: [], keys: [] });
  });
});
