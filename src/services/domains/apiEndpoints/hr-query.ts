export type HrQueryValue = string | number | boolean | null | undefined;

export type HrQueryParams = Record<string, HrQueryValue>;

export function buildHrApiQuery(params: HrQueryParams): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    query[key] = String(value);
  }
  return query;
}

export function withHrApiQuery(path: string, params: HrQueryParams): string {
  const query = buildHrApiQuery(params);
  const qs = new URLSearchParams(query).toString();
  return qs ? `${path}?${qs}` : path;
}

export function companyQuery(companyId: string): Record<string, string> {
  return buildHrApiQuery({ companyId: String(companyId ?? '').trim() });
}

export function companyEmployeeQuery(companyId: string, employeeId?: string): Record<string, string> {
  return buildHrApiQuery({
    companyId: String(companyId ?? '').trim(),
    employeeId: String(employeeId ?? '').trim(),
  });
}

export function companyYearQuery(companyId: string, year?: string | number): Record<string, string> {
  return buildHrApiQuery({
    companyId: String(companyId ?? '').trim(),
    year,
  });
}

export type EmployeesPagedQuerySource = {
  companyId: string;
  tab?: string;
  page?: number;
  pageSize?: number;
  q?: string;
  sortBy?: string;
  sortDir?: string;
};

export function buildEmployeesPagedApiQuery(source: EmployeesPagedQuerySource): Record<string, string> {
  return buildHrApiQuery({
    companyId: String(source.companyId ?? '').trim(),
    page: source.page ?? 1,
    pageSize: source.pageSize ?? 50,
    tab: source.tab || 'active',
    q: String(source.q ?? '').trim(),
    sortBy: source.sortBy,
    sortDir: source.sortDir,
  });
}
