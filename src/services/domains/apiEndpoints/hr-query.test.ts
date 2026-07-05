import { describe, expect, it } from 'vitest';
import {
  buildEmployeesPagedApiQuery,
  buildHrApiQuery,
  companyEmployeeQuery,
  companyQuery,
  companyYearQuery,
  withHrApiQuery,
} from './hr-query';

describe('hr-query', () => {
  it('drops empty values and stringifies supported query params', () => {
    expect(buildHrApiQuery({ companyId: ' company-1 ', empty: '', year: 2026, flag: true })).toEqual({
      companyId: ' company-1 ',
      year: '2026',
      flag: 'true',
    });
  });

  it('builds encoded paths without manual query string concatenation', () => {
    expect(withHrApiQuery('/api/v1/hr/leaves/leave 1', { companyId: 'company 1', voidSettlement: true })).toBe(
      '/api/v1/hr/leaves/leave 1?companyId=company+1&voidSettlement=true',
    );
  });

  it('normalizes common HR query shapes', () => {
    expect(companyQuery(' company-1 ')).toEqual({ companyId: 'company-1' });
    expect(companyEmployeeQuery(' company-1 ', ' employee-1 ')).toEqual({
      companyId: 'company-1',
      employeeId: 'employee-1',
    });
    expect(companyYearQuery(' company-1 ', 2026)).toEqual({ companyId: 'company-1', year: '2026' });
  });

  it('builds employees paged params centrally', () => {
    expect(
      buildEmployeesPagedApiQuery({
        companyId: ' company-1 ',
        tab: 'terminated',
        page: 2,
        pageSize: 25,
        q: '  Ali  ',
        sortBy: 'nameAr',
        sortDir: 'asc',
      }),
    ).toEqual({
      companyId: 'company-1',
      tab: 'terminated',
      page: '2',
      pageSize: '25',
      q: 'Ali',
      sortBy: 'nameAr',
      sortDir: 'asc',
    });
  });
});
