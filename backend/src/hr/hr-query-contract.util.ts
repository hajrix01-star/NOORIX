export type HrEmployeeQueryContract = {
  companyId: string;
  employeeId?: string;
};

export type HrYearQueryContract = {
  companyId: string;
  year?: number;
};

export type HrLeavesQueryContract = HrEmployeeQueryContract & {
  year?: number;
};

export type HrResidenciesQueryContract = HrEmployeeQueryContract & {
  serviceCategory?: string;
};

export function normalizeHrEmployeeQuery(companyId: string, query: { employeeId?: unknown }): HrEmployeeQueryContract {
  return {
    companyId,
    employeeId: optionalString(query.employeeId),
  };
}

export function normalizeHrYearQuery(companyId: string, query: { year?: unknown }): HrYearQueryContract {
  return {
    companyId,
    year: optionalYear(query.year),
  };
}

export function normalizeHrLeavesQuery(
  companyId: string,
  query: { employeeId?: unknown; year?: unknown },
): HrLeavesQueryContract {
  return {
    ...normalizeHrEmployeeQuery(companyId, query),
    year: optionalYear(query.year),
  };
}

export function normalizeHrResidenciesQuery(
  companyId: string,
  query: { employeeId?: unknown; serviceCategory?: unknown },
): HrResidenciesQueryContract {
  return {
    ...normalizeHrEmployeeQuery(companyId, query),
    serviceCategory: optionalString(query.serviceCategory),
  };
}

export function parseHrCsvIds(value: unknown): string[] | undefined {
  const ids = optionalString(value)
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return ids?.length ? ids : undefined;
}

function optionalString(value: unknown): string | undefined {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

function optionalYear(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isInteger(parsed) ? parsed : undefined;
}
