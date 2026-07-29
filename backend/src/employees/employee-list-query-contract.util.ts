import { Prisma } from '@prisma/client';
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

export const employeeListSelect = {
  id: true,
  employeeSerial: true,
  name: true,
  nameEn: true,
  jobTitle: true,
  basicSalary: true,
  housingAllowance: true,
  transportAllowance: true,
  otherAllowance: true,
  workHours: true,
  workSchedule: true,
  iqamaNumber: true,
  joinDate: true,
  status: true,
  notes: true,
  photoPath: true,
  photoMime: true,
  photoOriginalName: true,
  createdAt: true,
} satisfies Prisma.EmployeeSelect;

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

export function buildEmployeeTabWhere(
  companyId: string,
  tab: EmployeeListTab,
  q?: string,
): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = { companyId };
  if (tab === 'active') {
    where.status = { notIn: ['terminated', 'archived'] };
  } else if (tab === 'terminated') {
    where.status = 'terminated';
  } else {
    where.status = 'archived';
  }
  const needle = (q || '').trim();
  if (needle.length > 0) {
    where.OR = [
      { name: { contains: needle, mode: 'insensitive' } },
      { nameEn: { contains: needle, mode: 'insensitive' } },
      { employeeSerial: { contains: needle, mode: 'insensitive' } },
      { jobTitle: { contains: needle, mode: 'insensitive' } },
    ];
  }
  return where;
}

export function buildEmployeeOrderBy(
  sortBy?: string,
  sortDir?: string,
): Prisma.EmployeeOrderByWithRelationInput {
  const dir = sortDir === 'asc' ? 'asc' : 'desc';
  switch (sortBy) {
    case 'employeeSerial': return { employeeSerial: dir };
    case 'name': return { name: dir };
    case 'jobTitle': return { jobTitle: dir };
    case 'joinDate': return { joinDate: dir };
    case 'totalSalary':
    case 'basicSalary': return { basicSalary: dir };
    case 'status': return { status: dir };
    default: return { joinDate: 'desc' };
  }
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
