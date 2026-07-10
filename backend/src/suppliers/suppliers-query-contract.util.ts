export type SuppliersListQueryContract = {
  page?: string;
  pageSize?: string;
  q?: string;
};

function positiveInteger(value: string | undefined, fallback: number) {
  const numeric = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function parseSuppliersListQuery(query: SuppliersListQueryContract) {
  return {
    page: positiveInteger(query.page, 1),
    pageSize: positiveInteger(query.pageSize, 50),
    q: query.q?.trim() || undefined,
  };
}
