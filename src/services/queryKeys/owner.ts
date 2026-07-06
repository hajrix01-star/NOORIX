export const ownerKeys = {
  overview: (companyIds: string[], year: number, month: number | null) =>
    ['owner-overview', companyIds.slice().sort().join(','), year, month] as const,

  overviewRoot: () => ['owner-overview'] as const,
};
