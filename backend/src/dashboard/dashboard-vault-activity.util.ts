import Decimal from 'decimal.js';

export type DashboardVaultActivityInput = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  type: string;
  sortOrder: number;
  isArchived: boolean;
  totalIn: number | string;
  totalOut: number | string;
};

export type DashboardVaultActivityRow = {
  vaultId: string;
  nameAr: string;
  nameEn: string | null;
  type: string;
  isArchived: boolean;
  inflow: string;
  outflow: string;
  periodResult: string;
  inflowSharePct: number | null;
};

export type DashboardVaultActivity = {
  totalInflow: string;
  totalOutflow: string;
  periodResult: string;
  rows: DashboardVaultActivityRow[];
};

export function buildDashboardVaultActivity(
  vaults: readonly DashboardVaultActivityInput[],
): DashboardVaultActivity {
  const totalInflow = vaults.reduce(
    (sum, vault) => sum.plus(new Decimal(vault.totalIn || 0)),
    new Decimal(0),
  );
  const totalOutflow = vaults.reduce(
    (sum, vault) => sum.plus(new Decimal(vault.totalOut || 0)),
    new Decimal(0),
  );

  const rows = [...vaults]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, 'ar'))
    .map((vault) => {
      const inflow = new Decimal(vault.totalIn || 0);
      const outflow = new Decimal(vault.totalOut || 0);
      return {
        vaultId: vault.id,
        nameAr: vault.nameAr,
        nameEn: vault.nameEn,
        type: vault.type,
        isArchived: vault.isArchived,
        inflow: inflow.toString(),
        outflow: outflow.toString(),
        periodResult: inflow.minus(outflow).toString(),
        inflowSharePct: totalInflow.isZero()
          ? null
          : inflow.div(totalInflow).mul(100).toDecimalPlaces(2).toNumber(),
      };
    });

  return {
    totalInflow: totalInflow.toString(),
    totalOutflow: totalOutflow.toString(),
    periodResult: totalInflow.minus(totalOutflow).toString(),
    rows,
  };
}
