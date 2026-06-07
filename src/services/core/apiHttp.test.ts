import { describe, expect, it } from 'vitest';
import { unwrapApiList } from './apiHttp';

describe('unwrapApiList', () => {
  it('reads direct arrays', () => {
    expect(unwrapApiList({ success: true, data: [{ id: 'a' }] })).toEqual([{ id: 'a' }]);
  });

  it('reads items envelopes', () => {
    expect(unwrapApiList({ success: true, data: { items: [{ id: 'b' }] } })).toEqual([{ id: 'b' }]);
  });

  it('reads nested data envelopes', () => {
    expect(unwrapApiList({ success: true, data: { data: { items: [{ id: 'c' }] } } })).toEqual([{ id: 'c' }]);
  });

  it('throws failed responses', () => {
    expect(() => unwrapApiList({ success: false, error: 'boom' })).toThrow('boom');
  });
});
