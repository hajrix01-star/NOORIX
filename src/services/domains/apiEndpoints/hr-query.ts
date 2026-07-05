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

export type EmployeesPagedQueryInput = {
  companyId: string;
  tab: string;
  page: number;
  pageSize: number;
  q: string;
  sortBy: string;
  sortDir: string;
};

export function normalizeEmployeesPagedQueryInput(
  source: EmployeesPagedQuerySource,
): EmployeesPagedQueryInput {
  return {
    companyId: String(source.companyId ?? '').trim(),
    tab: normalizeEmployeeTab(source.tab),
    page: clampInt(source.page, 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampInt(source.pageSize, 50, 1, 200),
    q: String(source.q ?? '').trim().slice(0, 120),
    sortBy: String(source.sortBy ?? 'joinDate').trim() || 'joinDate',
    sortDir: source.sortDir === 'asc' ? 'asc' : 'desc',
  };
}

export function buildEmployeesPagedApiQuery(source: EmployeesPagedQuerySource): Record<string, string> {
  const normalized = normalizeEmployeesPagedQueryInput(source);
  return buildHrApiQuery(normalized);
}

function normalizeEmployeeTab(value: unknown): string {
  return value === 'terminated' || value === 'archived' ? value : 'active';
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
