/**
 * قيود دفتر المبيعات اليومية (قنوات) — مستخرج من FinancialInflowService.
 */
import { validateJournalBalance } from './financial-core-helpers.util';
import { reportingClassForReferenceType } from './financial-reporting-classification.util';
import type { ChannelNetTaxRow, InflowChannelInput } from './financial-inflow-channels.util';
import type { TxClient } from './financial-core-helpers.util';
import type { LedgerEntry } from '@prisma/client';

export async function createInflowSaleLedgerEntries(params: {
  tx: TxClient;
  tenantId: string;
  companyId: string;
  userId: string;
  entryDate: Date;
  txDate: Date;
  referenceId: string;
  activeChannels: InflowChannelInput[];
  channelNetTax: ChannelNetTaxRow[];
  vaultAccounts: string[];
  revenueAccountId: string;
  vatAccountId: string | null;
  vatEnabled: boolean;
  /** عند true يُعاد مصفوفة القيود المنشأة (processInflow) */
  collectResults?: boolean;
}): Promise<LedgerEntry[]> {
  const {
    tx,
    tenantId,
    companyId,
    userId,
    entryDate,
    txDate,
    referenceId,
    activeChannels,
    channelNetTax,
    vaultAccounts,
    revenueAccountId,
    vatAccountId,
    vatEnabled,
    collectResults,
  } = params;

  validateJournalBalance(
    activeChannels.map((ch) => ({ amount: ch.amount })),
    channelNetTax.flatMap(({ net, tax }) =>
      vatEnabled && tax.gt(0) ? [{ amount: net }, { amount: tax }] : [{ amount: net }],
    ),
  );

  const ledgerEntries: LedgerEntry[] = [];
  for (let idx = 0; idx < activeChannels.length; idx++) {
    const ch = activeChannels[idx];
    const { net, tax } = channelNetTax[idx];
    const vaultAcc = vaultAccounts[idx];

    const entryRevenue = await tx.ledgerEntry.create({
      data: {
        tenantId,
        companyId,
        debitAccountId:  vaultAcc,
        creditAccountId: revenueAccountId,
        amount:          net,
        transactionDate: txDate,
        entryDate,
        referenceType:   'sale',
        referenceId,
        reportingClass:  reportingClassForReferenceType('sale'),
        vaultId:         ch.vaultId,
        createdById:     userId,
        status:          'active',
      },
    });
    if (collectResults) ledgerEntries.push(entryRevenue);

    if (vatEnabled && tax.gt(0) && vatAccountId) {
      const entryVat = await tx.ledgerEntry.create({
        data: {
          tenantId,
          companyId,
          debitAccountId:  vaultAcc,
          creditAccountId: vatAccountId,
          amount:          tax,
          transactionDate: txDate,
          entryDate,
          referenceType:   'sale',
          referenceId,
          reportingClass:  reportingClassForReferenceType('sale', { isVat: true }),
          vaultId:         ch.vaultId,
          createdById:     userId,
          status:          'active',
        },
      });
      if (collectResults) ledgerEntries.push(entryVat);
    }
  }
  return ledgerEntries;
}
