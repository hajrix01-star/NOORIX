/**
 * إلغاء فاتورة/ملخص مبيعات (بدون حذف)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { nowSaudi } from '../common/utils/date-utils';
import { FinancialCoreSupportService } from './financial-core-support.service';
import type { CancelOperationDto } from './dto/financial-operation.dto';
import type { JsonObject } from './financial-core-helpers.util';
import type { TxClient } from './financial-core-helpers.util';

@Injectable()
export class FinancialCancelService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly support: FinancialCoreSupportService,
  ) {}

  // 4. CANCEL — إلغاء عملية سابقة (لا حذف — Status: cancelled)
  // ══════════════════════════════════════════════════════════
  /**
   * cancelOperation: يُغيّر status → 'cancelled' لـ:
   *   - الفاتورة (إن كانت invoice)
   *   - ملخص المبيعات (إن كان sale)
   *   - جميع القيود المرتبطة (LedgerEntries)
   *   - يُسجّل في AuditLog
   *
   * ✅ لا حذف فعلي — سلامة البيانات المحاسبية محفوظة دائماً.
   */
  async cancelOperation(dto: CancelOperationDto, callerUserId?: string) {
    const userId   = this.support.resolveUserId(callerUserId);
    const tenantId = this.support.resolveTenantId();
    const entryDate = nowSaudi();

    return this.db.withTenant(async (tx) => {
      // ── [A] إلغاء الوثيقة الأصلية ────────────────────────
      let oldSnapshot: Record<string, unknown> = {};
      let purchaseDebtReopened = false;

      if (dto.referenceType === 'invoice' || dto.referenceType === 'salary' || dto.referenceType === 'advance') {
        const inv = await tx.invoice.findFirst({
          where: { id: dto.referenceId, companyId: dto.companyId },
        });
        if (!inv) throw new NotFoundException('الفاتورة غير موجودة أو لا تنتمي لهذه الشركة');
        if (inv.status === 'cancelled') {
          throw new BadRequestException('الفاتورة ملغاة مسبقاً');
        }
        oldSnapshot = this.support.invoiceSnapshot(inv);
        await tx.invoice.update({
          where: { id: dto.referenceId },
          data:  { status: 'cancelled' },
        });

        const promotedDebt = await tx.purchaseDebtRecord.findFirst({
          where: { companyId: dto.companyId, promotedInvoiceId: dto.referenceId, status: 'promoted' },
          select: { id: true },
        });
        if (promotedDebt) {
          await tx.purchaseDebtRecord.update({
            where: { id: promotedDebt.id },
            data: {
              status: 'pending', promotedAt: null, promotedByUserId: null,
              promotedInvoiceId: null, promotionBatchId: null, promotionIdempotencyKey: null,
              promotionInvoiceIds: [],
            },
          });
          await tx.auditLog.create({
            data: {
              tenantId, companyId: dto.companyId, userId, action: 'update',
              entity: 'purchase_debt_record', entityId: promotedDebt.id,
              oldValue: { status: 'promoted', promotedInvoiceId: dto.referenceId } as JsonObject,
              newValue: { status: 'pending', reopenedBecauseInvoiceCancelled: dto.referenceId } as JsonObject,
              createdAt: entryDate,
            },
          });
          purchaseDebtReopened = true;
        }

      } else if (dto.referenceType === 'sale') {
        const summary = await tx.dailySalesSummary.findFirst({
          where: { id: dto.referenceId, companyId: dto.companyId },
          include: { saleInvoice: true },
        });
        if (!summary) throw new NotFoundException('الملخص غير موجود');
        if (summary.status === 'cancelled') {
          throw new BadRequestException('الملخص ملغى مسبقاً');
        }
        oldSnapshot = { id: summary.id, summaryNumber: summary.summaryNumber, totalAmount: String(summary.totalAmount) };
        await tx.dailySalesSummary.update({
          where: { id: dto.referenceId },
          data:  { status: 'cancelled' },
        });
        // إلغاء فاتورة المبيعات المرتبطة (للعرض الموحد في قسم الفواتير)
        if (summary.saleInvoice) {
          await tx.invoice.update({
            where: { id: summary.saleInvoice.id },
            data:  { status: 'cancelled' },
          });
        }
      }

      // ── [B] إلغاء جميع القيود المرتبطة ──────────────────
      const ledgerCount = await tx.ledgerEntry.updateMany({
        where: {
          companyId:     dto.companyId,
          referenceType: dto.referenceType,
          referenceId:   dto.referenceId,
          status:        'active',
        },
        data: { status: 'cancelled' },
      });

      // ── [C] AuditLog ─────────────────────────────────────
      await tx.auditLog.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          userId,
          action:    'cancel',
          entity:    dto.referenceType,
          entityId:  dto.referenceId,
          oldValue:  { ...oldSnapshot, status: 'active' }    as JsonObject,
          newValue:  { ...oldSnapshot, status: 'cancelled', reason: dto.reason, cancelledBy: userId } as JsonObject,
          createdAt: entryDate,
        },
      });

      return {
        cancelled:      true,
        referenceType:  dto.referenceType,
        referenceId:    dto.referenceId,
        ledgersCancelled: ledgerCount.count,
        purchaseDebtReopened,
      };
    });
  }

  // ══════════════════════════════════════════════════════════
  // PRIVATE: Retry على تعارض المعاملات (Prisma P2034)
  // ══════════════════════════════════════════════════════════

}
