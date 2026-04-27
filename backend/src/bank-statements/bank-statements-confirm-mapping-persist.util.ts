import { BadRequestException, Logger } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { parseBankStatementRows } from './bank-statement-row-parser';
import {
  RAW_DATA_MAX_ROWS,
  sanitizeCell,
  toBankRowMapping,
  type ColumnMapping,
} from './bank-statements-header-heuristic.util';
import { trySaveBankStatementTemplateAfterConfirm } from './bank-statement-save-template.util';
import { applyBankStatementClassificationAndSummary } from './apply-bank-classification-summary.util';
import {
  assertConfirmMappingColumnMappingValid,
  buildBankStatementConfirmTransactions,
} from './bank-statements-confirm-aggregate.util';

export type ConfirmMappingDto = {
  companyName: string;
  bankName: string;
  startDate?: string;
  endDate?: string;
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
  columnMapping: ColumnMapping;
  raw: string[][];
};

/**
 * تطبيق التعيين: حذف حركات سابقة، تحديث الكشف، إنشاء الحركات، قالب، تصنيف.
 */
export async function persistBankStatementConfirmMapping(
  prisma: TenantPrismaService,
  logger: Logger,
  companyId: string,
  id: string,
  dto: ConfirmMappingDto,
): Promise<void> {
  const stmt = await prisma.bankStatement.findFirst({
    where: { id, companyId },
    select: { id: true, rawData: true },
  });
  if (!stmt) throw new BadRequestException('الكشف غير موجود');

  const tenantId = TenantContext.getTenantId();
  const raw = dto.raw?.length ? dto.raw : (stmt.rawData as string[][]);
  if (!raw?.length) throw new BadRequestException('لا توجد بيانات');

  const map = dto.columnMapping;
  assertConfirmMappingColumnMappingValid(map);

  const start = Math.max(0, dto.dataStartRow);
  const end = Math.min(raw.length - 1, dto.dataEndRow);

  const brm = toBankRowMapping(map);
  if (!brm) throw new BadRequestException('تعيين عمود التاريخ غير صالح');

  const parsed = parseBankStatementRows(
    raw as unknown[][],
    brm,
    start,
    end,
    dto.startDate || null,
  );

  const { totalDeposits, totalWithdrawals, transactions } = buildBankStatementConfirmTransactions(
    parsed,
    sanitizeCell,
  );

  const rawToStore = (dto.raw?.length ? dto.raw : raw).slice(0, RAW_DATA_MAX_ROWS);

  await prisma.$transaction([
    prisma.bankStatementTransaction.deleteMany({ where: { statementId: id } }),
    prisma.bankStatement.update({
      where: { id },
      data: {
        companyName: dto.companyName || '',
        bankName: dto.bankName || 'كشف الحساب',
        startDate: dto.startDate || null,
        endDate: dto.endDate || null,
        headerRow: dto.headerRow,
        dataStartRow: dto.dataStartRow,
        dataEndRow: dto.dataEndRow,
        columnMapping: dto.columnMapping as object,
        rawData: rawToStore as object,
        totalDeposits,
        totalWithdrawals,
        transactionCount: transactions.length,
        status: 'completed',
      },
    }),
  ]);

  if (transactions.length > 0) {
    await prisma.bankStatementTransaction.createMany({
      data: transactions.map((t) => ({
        statementId: id,
        txDate: t.txDate,
        description: t.description,
        debit: t.debit,
        credit: t.credit,
        balance: t.balance,
        reference: t.reference,
        sortOrder: t.sortOrder,
        categoryId: t.categoryId,
      })),
    });
  }

  await trySaveBankStatementTemplateAfterConfirm(prisma, logger, {
    tenantId,
    companyId,
    dto: {
      companyName: dto.companyName || '',
      bankName: dto.bankName || 'كشف الحساب',
      headerRow: dto.headerRow,
      dataStartRow: dto.dataStartRow,
      dataEndRow: dto.dataEndRow,
      columnMapping: dto.columnMapping,
    },
    raw,
  });
  await applyBankStatementClassificationAndSummary(prisma, companyId, id);
}
