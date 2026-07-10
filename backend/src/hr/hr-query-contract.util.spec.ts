import {
  normalizeHrEmployeeQuery,
  normalizeHrLeavesQuery,
  normalizeHrResidenciesQuery,
  normalizeHrYearQuery,
  parseHrCsvIds,
} from './hr-query-contract.util';

describe('hr-query-contract', () => {
  it('normalizes common employee and year query contracts', () => {
    expect(normalizeHrEmployeeQuery('company-1', { employeeId: ' employee-1 ' })).toEqual({
      companyId: 'company-1',
      employeeId: 'employee-1',
    });
    expect(normalizeHrYearQuery('company-1', { year: '2026' })).toEqual({
      companyId: 'company-1',
      year: 2026,
    });
  });

  it('normalizes leave and residency query contracts', () => {
    expect(normalizeHrLeavesQuery('company-1', { employeeId: ' employee-1 ', year: 2026 })).toEqual({
      companyId: 'company-1',
      employeeId: 'employee-1',
      year: 2026,
    });
    expect(normalizeHrResidenciesQuery('company-1', { employeeId: '', serviceCategory: ' iqama ' })).toEqual({
      companyId: 'company-1',
      employeeId: undefined,
      serviceCategory: 'iqama',
    });
  });

  it('parses CSV ids safely', () => {
    expect(parseHrCsvIds(' a, ,b , c')).toEqual(['a', 'b', 'c']);
    expect(parseHrCsvIds(' ')).toBeUndefined();
  });

  it('does not partially parse invalid years', () => {
    expect(normalizeHrYearQuery('company-1', { year: '2026abc' })).toEqual({
      companyId: 'company-1',
      year: undefined,
    });
  });
});
