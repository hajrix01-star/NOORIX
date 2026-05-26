import { describe, expect, it } from 'vitest';
import { unwrapApiData, unwrapApiDataOr } from './apiHttp';
import type { ApiParsedResult } from '../../types/api';

describe('unwrapApiData', () => {
  it('returns data when success is true', () => {
    const res: ApiParsedResult<{ id: string }> = { success: true, data: { id: '1' } };
    expect(unwrapApiData(res)).toEqual({ id: '1' });
  });

  it('throws when success is false', () => {
    const res: ApiParsedResult = { success: false, error: 'fail' };
    expect(() => unwrapApiData(res)).toThrow('fail');
  });

  it('throws when data is missing', () => {
    const res: ApiParsedResult = { success: true };
    expect(() => unwrapApiData(res, 'missing')).toThrow('missing');
  });
});

describe('unwrapApiDataOr', () => {
  it('returns fallback when data is undefined', () => {
    const fallback = { sections: [], totalOrders: 0, pendingCount: 0 };
    const res: ApiParsedResult<typeof fallback> = { success: true };
    expect(unwrapApiDataOr(res, fallback)).toEqual(fallback);
  });
});
