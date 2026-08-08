export const loanKeys = {
  root: () => ['loans'] as const,
  list: (companyId: string) => ['loans', companyId] as const,
};
