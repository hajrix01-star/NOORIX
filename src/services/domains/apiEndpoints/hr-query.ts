export type HrQueryValue = string | number | boolean | null | undefined;
export type HrEmployeeTabQuery = 'active' | 'terminated' | 'archived';

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

export function companyEmployeeYearQuery(
  companyId: string,
  employeeId?: string,
  year?: string | number,
): Record<string, string> {
  return buildHrApiQuery({
    companyId: String(companyId ?? '').trim(),
    employeeId: String(employeeId ?? '').trim(),
    year,
  });
}

export function companyEmployeeIdsQuery(companyId: string, employeeIds: readonly string[] = []): Record<string, string> {
  return buildHrApiQuery({
    companyId: String(companyId ?? '').trim(),
    employeeIds: employeeIds.map((id) => String(id).trim()).filter(Boolean).join(','),
  });
}

export function companyYearQuery(companyId: string, year?: string | number): Record<string, string> {
  return buildHrApiQuery({
    companyId: String(companyId ?? '').trim(),
    year,
  });
}

export function companyPayrollMonthQuery(companyId: string, payrollMonth: string | number): Record<string, string> {
  return buildHrApiQuery({
    companyId: String(companyId ?? '').trim(),
    payrollMonth,
  });
}

export function companyDeleteLeaveQuery(companyId: string, voidSettlement = false): Record<string, string> {
  return buildHrApiQuery({
    companyId: String(companyId ?? '').trim(),
    voidSettlement: voidSettlement || undefined,
  });
}

export function companyDeleteResidencyQuery(companyId: string, voidInvoice = false): Record<string, string> {
  return buildHrApiQuery({
    companyId: String(companyId ?? '').trim(),
    voidInvoice: voidInvoice || undefined,
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
  tab: HrEmployeeTabQuery;
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

function normalizeEmployeeTab(value: unknown): HrEmployeeTabQuery {
  return value === 'terminated' || value === 'archived' ? value : 'active';
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
