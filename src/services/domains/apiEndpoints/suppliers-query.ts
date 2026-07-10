export type SuppliersListQuery = {
  companyId: string;
  page?: number;
  pageSize?: number;
  q?: string;
};

function positiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const integer = Math.trunc(Number(value));
  return integer > 0 ? integer : fallback;
}

export function normalizeSuppliersListQuery(query: SuppliersListQuery) {
  return {
    companyId: query.companyId,
    page: positiveInteger(query.page, 1),
    pageSize: positiveInteger(query.pageSize, 50),
    q: query.q?.trim() || undefined,
  };
}

export function suppliersListQueryParams(query: SuppliersListQuery): Record<string, string> {
  const normalized = normalizeSuppliersListQuery(query);
  const params: Record<string, string> = {
    companyId: normalized.companyId,
    page: String(normalized.page),
    pageSize: String(normalized.pageSize),
  };
  if (normalized.q) params.q = normalized.q;
  return params;
}
