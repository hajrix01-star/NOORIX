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
  transferIn?: number | string;
  transferOut?: number | string;
  externalIn?: number | string;
  externalOut?: number | string;
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
  transferIn: string;
  transferOut: string;
};

export type DashboardVaultActivity = {
  totalInflow: string;
  totalOutflow: string;
  periodResult: string;
  transferVolume: string;
  rows: DashboardVaultActivityRow[];
};

export function buildDashboardVaultActivity(
  vaults: readonly DashboardVaultActivityInput[],
): DashboardVaultActivity {
  const totalInflow = vaults.reduce(
    (sum, vault) => sum.plus(new Decimal(vault.externalIn ?? vault.totalIn ?? 0)),
    new Decimal(0),
  );
  const totalOutflow = vaults.reduce(
    (sum, vault) => sum.plus(new Decimal(vault.externalOut ?? vault.totalOut ?? 0)),
    new Decimal(0),
  );

  const rows = [...vaults]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, 'ar'))
    .map((vault) => {
      const inflow = new Decimal(vault.externalIn ?? vault.totalIn ?? 0);
      const outflow = new Decimal(vault.externalOut ?? vault.totalOut ?? 0);
      const transferIn = new Decimal(vault.transferIn || 0);
      const transferOut = new Decimal(vault.transferOut || 0);
      return {
        vaultId: vault.id,
        nameAr: vault.nameAr,
        nameEn: vault.nameEn,
        type: vault.type,
        isArchived: vault.isArchived,
        inflow: inflow.toString(),
        outflow: outflow.toString(),
        // Internal transfers cancel only at company level; each vault must still
        // reconcile to its complete ledger movement for the selected period.
        periodResult: inflow.plus(transferIn).minus(outflow.plus(transferOut)).toString(),
        inflowSharePct: totalInflow.isZero()
          ? null
          : inflow.div(totalInflow).mul(100).toDecimalPlaces(2).toNumber(),
        transferIn: transferIn.toString(),
        transferOut: transferOut.toString(),
      };
    });

  return {
    totalInflow: totalInflow.toString(),
    totalOutflow: totalOutflow.toString(),
    periodResult: totalInflow.minus(totalOutflow).toString(),
    transferVolume: vaults.reduce(
      (sum, vault) => sum.plus(new Decimal(vault.transferIn || 0)),
      new Decimal(0),
    ).toString(),
    rows,
  };
}
