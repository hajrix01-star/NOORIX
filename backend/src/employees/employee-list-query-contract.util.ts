import type { EmployeeListQueryDto } from './dto/employee-list-query.dto';

const EMPLOYEE_SEARCH_MAX_LENGTH = 120;

export type EmployeeListTab = 'active' | 'terminated' | 'archived';

export type EmployeeListQueryContract = {
  companyId: string;
  includeTerminated: boolean;
  page?: number;
  pageSize: number;
  tab: EmployeeListTab;
  q?: string;
  sortBy?: string;
  sortDir: 'asc' | 'desc';
  bulk: boolean;
  isPaged: boolean;
};

export function normalizeEmployeeListQuery(
  companyId: string,
  query: EmployeeListQueryDto,
): EmployeeListQueryContract {
  return {
    companyId,
    includeTerminated: query.includeTerminated === true,
    page: query.page == null ? undefined : clampInt(query.page, 1, 1, Number.MAX_SAFE_INTEGER),
    pageSize: clampInt(query.pageSize, 50, 1, 200),
    tab: normalizeEmployeeTab(query.tab),
    q: optionalString(query.q)?.slice(0, EMPLOYEE_SEARCH_MAX_LENGTH),
    sortBy: optionalString(query.sortBy),
    sortDir: query.sortDir === 'asc' ? 'asc' : 'desc',
    bulk: query.bulk === true,
    isPaged: query.page != null,
  };
}

export function normalizeEmployeeTab(value: unknown): EmployeeListTab {
  return value === 'terminated' || value === 'archived' ? value : 'active';
}

function optionalString(value: unknown): string | undefined {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
