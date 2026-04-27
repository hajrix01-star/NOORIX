import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type JsonObject = Prisma.InputJsonValue;
export type TxClient = Parameters<Parameters<TenantPrismaService['$transaction']>[0]>[0];

export const RETRY_MAX = 3;
export const RETRY_BASE_MS = 100;
export const OPERATION_NOTES_MAX_LEN = 2000;

export function assertOperationNotesLength(notes: string | undefined | null): void {
  if (notes == null || notes === '') return;
  if (notes.length > OPERATION_NOTES_MAX_LEN) {
    throw new BadRequestException(`الملاحظة تتجاوز ${OPERATION_NOTES_MAX_LEN} حرفًا`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function getRetryDelayMs(attempt: number): number {
  const baseDelay = Math.pow(2, attempt) * RETRY_BASE_MS;
  const jitter = Math.floor(Math.random() * 50);
  return baseDelay + jitter;
}

/**
 * مجموع المدين يجب أن يساوي مجموع الدائن (Decimal).
 * استدعاءات الإنتاج: `financial-outflow.service` (إنشاء/دفعة/استبدال قيود + مزامنة تاريخ القيود مع الفاتورة)،
 * `financial-inflow.service` (تسجيل وتحديث مبيعات)، `financial-transfer.service` (تحويل 1:1).
 */
export function validateJournalBalance(
  debitEntries:  Array<{ amount: Prisma.Decimal | number | string }>,
  creditEntries: Array<{ amount: Prisma.Decimal | number | string }>,
): void {
  const sum = (arr: Array<{ amount: Prisma.Decimal | number | string }>) =>
    arr.reduce(
      (s, e) => s.plus(new Prisma.Decimal(String(e.amount))),
      new Prisma.Decimal(0),
    );

  const debitTotal  = sum(debitEntries);
  const creditTotal = sum(creditEntries);

  if (!debitTotal.isFinite() || !creditTotal.isFinite()) {
    throw new BadRequestException(
      `Journal entry contains non-finite amount: debit=${debitTotal}, credit=${creditTotal}`,
    );
  }
  if (!debitTotal.equals(creditTotal)) {
    throw new BadRequestException(
      `Unbalanced journal entry: debit (${debitTotal.toFixed(4)}) ≠ credit (${creditTotal.toFixed(4)})`,
    );
  }
}
