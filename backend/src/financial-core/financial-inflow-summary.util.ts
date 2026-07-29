import { BadRequestException } from '@nestjs/common';
import type { SalesShift } from './dto/financial-operation.dto';
import type { TxClient } from './financial-core-helpers.util';
import {
  buildActiveSalesSummaryShiftDuplicateWhere,
  normalizeSalesSummaryShift,
} from '../sales/sales-summary-duplicate.util';

export function normalizeInflowSalesShift(value: unknown): SalesShift {
  return normalizeSalesSummaryShift(value);
}

export async function assertNoActiveSummaryForShift(input: {
  tx: TxClient;
  companyId: string;
  transactionDate: Date;
  shift: SalesShift;
  excludeId?: string;
}): Promise<void> {
  const duplicate = await input.tx.dailySalesSummary.findFirst({
    where: buildActiveSalesSummaryShiftDuplicateWhere({
      companyId: input.companyId,
      transactionDate: input.transactionDate,
      shift: input.shift,
      excludeId: input.excludeId,
    }),
    select: { summaryNumber: true },
  });

  if (duplicate) {
    throw new BadRequestException(
      'يوجد ملخص مبيعات نشط لنفس التاريخ والشفت. ألغِ الملخص السابق أو عدّله بدلاً من إنشاء مكرر.',
    );
  }
}

export async function buildDailySalesSummaryNumber(
  tx: TxClient,
  companyId: string,
  transactionDate: string,
): Promise<string> {
  const dateStr = transactionDate.replace(/-/g, '').slice(0, 8);
  const existing = await tx.dailySalesSummary.count({
    where: { companyId, summaryNumber: { startsWith: `DS-${dateStr}` } },
  });
  return `DS-${dateStr}-${String(existing + 1).padStart(3, '0')}`;
}
