import Decimal from 'decimal.js';

export function debitCreditMapsFromGroupBy(
  debitRows: { debitAccountId: string; _sum: { amount: unknown } }[],
  creditRows: { creditAccountId: string; _sum: { amount: unknown } }[],
): { debitMap: Map<string, Decimal>; creditMap: Map<string, Decimal> } {
  const debitMap = new Map<string, Decimal>(
    debitRows.map((r) => [r.debitAccountId, new Decimal(String(r._sum.amount ?? 0))]),
  );
  const creditMap = new Map<string, Decimal>(
    creditRows.map((r) => [r.creditAccountId, new Decimal(String(r._sum.amount ?? 0))]),
  );
  return { debitMap, creditMap };
}

export function attachVaultLedgerBalances<T extends { accountId: string }>(
  vaults: T[],
  debitMap: Map<string, Decimal>,
  creditMap: Map<string, Decimal>,
  transferDebitMap: Map<string, Decimal> = new Map(),
  transferCreditMap: Map<string, Decimal> = new Map(),
): Array<T & {
  totalIn: number;
  totalOut: number;
  balance: number;
  transferIn: number;
  transferOut: number;
  externalIn: number;
  externalOut: number;
}> {
  return vaults.map((v) => {
    const totalIn = debitMap.get(v.accountId) ?? new Decimal(0);
    const totalOut = creditMap.get(v.accountId) ?? new Decimal(0);
    const balance = totalIn.minus(totalOut);
    const transferIn = transferDebitMap.get(v.accountId) ?? new Decimal(0);
    const transferOut = transferCreditMap.get(v.accountId) ?? new Decimal(0);
    return {
      ...v,
      totalIn: totalIn.toNumber(),
      totalOut: totalOut.toNumber(),
      balance: balance.toNumber(),
      transferIn: transferIn.toNumber(),
      transferOut: transferOut.toNumber(),
      externalIn: totalIn.minus(transferIn).toNumber(),
      externalOut: totalOut.minus(transferOut).toNumber(),
    };
  });
}
