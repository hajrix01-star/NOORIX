import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import type { ParsedBankRow } from './bank-statement-row-parser';
import type { ColumnMapping } from './bank-statements-header-heuristic.util';

export function assertConfirmMappingColumnMappingValid(map: ColumnMapping): void {
  const dateCol = map.dateCol ?? -1;
  const debitCol = map.debitCol ?? -1;
  const creditCol = map.creditCol ?? -1;
  const amountCol = map.amountCol ?? -1;
  const balanceCol = map.balanceCol ?? -1;
  const hasAmounts = debitCol >= 0 || creditCol >= 0 || amountCol >= 0 || balanceCol >= 0;
  if (dateCol < 0 || !hasAmounts) {
    throw new BadRequestException(
      'يجب تحديد عمود التاريخ وعمود المدين أو الدائن أو المبلغ أو الرصيد',
    );
  }
}

export type BankStatementConfirmTransactionRow = {
  txDate: string;
  description: string;
  debit: Decimal;
  credit: Decimal;
  balance: Decimal | null;
  reference: string | null;
  sortOrder: number;
  categoryId: string | null;
};

/** تجميع صفوف `parseBankStatementRows` إلى إجماليات وحُرُوف جاهزة لـ `createMany`. */
export function buildBankStatementConfirmTransactions(
  parsed: ParsedBankRow[],
  sanitizeCell: (s: string) => string,
): {
  totalDeposits: Decimal;
  totalWithdrawals: Decimal;
  transactions: BankStatementConfirmTransactionRow[];
} {
  let totalDeposits = new Decimal(0);
  let totalWithdrawals = new Decimal(0);
  const transactions: BankStatementConfirmTransactionRow[] = [];
  for (const p of parsed) {
    if (p.debit > 0) totalWithdrawals = totalWithdrawals.add(p.debit);
    if (p.credit > 0) totalDeposits = totalDeposits.add(p.credit);
    transactions.push({
      txDate: p.txDate,
      description: sanitizeCell(p.description),
      debit: new Decimal(p.debit),
      credit: new Decimal(p.credit),
      balance: p.balance != null ? new Decimal(p.balance) : null,
      reference: p.reference || null,
      sortOrder: p.sortOrder,
      categoryId: null,
    });
  }
  return { totalDeposits, totalWithdrawals, transactions };
}
