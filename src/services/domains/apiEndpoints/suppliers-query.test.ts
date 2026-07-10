import { describe, expect, it } from 'vitest';
import { normalizeSuppliersListQuery, suppliersListQueryParams } from './suppliers-query';

describe('suppliers query contract', () => {
  it('normalizes paging and search text', () => {
    expect(normalizeSuppliersListQuery({
      companyId: 'c1',
      page: 0,
      pageSize: -5,
      q: '  acme  ',
    })).toEqual({
      companyId: 'c1',
      page: 1,
      pageSize: 50,
      q: 'acme',
    });
  });

  it('serializes only the official supplier list params', () => {
    expect(suppliersListQueryParams({
      companyId: 'c1',
      page: 2,
      pageSize: 25,
      q: '',
    })).toEqual({
      companyId: 'c1',
      page: '2',
      pageSize: '25',
    });
  });
});
