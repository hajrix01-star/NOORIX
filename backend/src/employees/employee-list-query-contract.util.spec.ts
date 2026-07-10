import { normalizeEmployeeListQuery } from './employee-list-query-contract.util';

describe('normalizeEmployeeListQuery', () => {
  it('normalizes paged employee list query params', () => {
    expect(
      normalizeEmployeeListQuery('company-1', {
        page: 2,
        pageSize: 500,
        tab: 'terminated',
        q: '  Ali  ',
        sortBy: 'name',
        sortDir: 'asc',
      }),
    ).toEqual({
      companyId: 'company-1',
      includeTerminated: false,
      page: 2,
      pageSize: 200,
      tab: 'terminated',
      q: 'Ali',
      sortBy: 'name',
      sortDir: 'asc',
      bulk: false,
      isPaged: true,
    });
  });

  it('defaults invalid tab and sort direction safely', () => {
    expect(
      normalizeEmployeeListQuery('company-1', {
        tab: 'unknown',
        sortDir: 'sideways',
        includeTerminated: true,
        bulk: true,
      }),
    ).toEqual({
      companyId: 'company-1',
      includeTerminated: true,
      page: undefined,
      pageSize: 50,
      tab: 'active',
      q: undefined,
      sortBy: undefined,
      sortDir: 'desc',
      bulk: true,
      isPaged: false,
    });
  });

  it('limits search text to the supported query length', () => {
    expect(
      normalizeEmployeeListQuery('company-1', {
        q: 'x'.repeat(140),
      }).q,
    ).toHaveLength(120);
  });
});
