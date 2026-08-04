import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { OrdersV4ReceiveInput } from './orders-v4.contracts';
import { OrdersV4DocumentReversalService } from './orders-v4-document-reversal.service';
import {
  isOrdersV4CashierReopenEligible,
  isOrdersV4ReopenDateEligible,
  ORDERS_V4_CASHIER_REOPEN_LIMIT,
  ORDERS_V4_REOPEN_WINDOW_DAYS,
  ordersV4CashierRecentPurchasesQuery,
  type OrdersV4ReopenAccess,
} from './orders-v4-reopen.policy';

type OrdersV4Transaction = Prisma.TransactionClient;
type CorrectionDocument = Prisma.OrdersV4DocumentGetPayload<{
  include: {
    section: true;
    location: true;
    lines: { include: { item: true; inputUnit: true; baseUnit: true; priceUnit: true } };
  };
}>;

export type OrdersV4CorrectionPreparation = {
  duplicate: CorrectionDocument | null;
  targetId: string;
  receivedFromRevision: number;
  correctionSnapshot: Prisma.InputJsonObject;
  inheritedPaymentMethod: 'custody' | 'cash' | 'transfer' | null;
  inheritedPettyCashAmount: Prisma.Decimal | null;
};

@Injectable()
export class OrdersV4PurchaseCorrectionService {
  constructor(private readonly reversal: OrdersV4DocumentReversalService) {}

  async prepareInTransaction(
    tx: OrdersV4Transaction,
    input: OrdersV4ReceiveInput,
    context: {
      tenantId: string;
      companyId: string;
      userId: string | null;
      documentId: string;
      receivedDate: Date;
      correctionRequestHash: string;
      access: OrdersV4ReopenAccess;
    },
  ): Promise<OrdersV4CorrectionPreparation> {
    const duplicate = await tx.ordersV4Document.findFirst({
      where: { companyId: context.companyId, idempotencyKey: input.idempotencyKey.trim() },
      include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
    });
    if (duplicate) {
      if (duplicate.requestHash !== context.correctionRequestHash) throw new BadRequestException('مفتاح منع التكرار مستخدم لتصحيح مختلف');
      return {
        duplicate,
        targetId: duplicate.id,
        receivedFromRevision: duplicate.revision,
        correctionSnapshot: {},
        inheritedPaymentMethod: null,
        inheritedPettyCashAmount: null,
      };
    }

    const original = await tx.ordersV4Document.findFirst({
      where: { id: context.documentId, companyId: context.companyId, documentType: 'purchase', status: 'received', reversalOfId: null },
    });
    if (!original) throw new BadRequestException('الطلب المستلم غير موجود أو سبق تعديله');
    if (original.revision !== input.revision) throw new BadRequestException('تم تعديل الطلب؛ أعد تحميله قبل الحفظ');
    if (context.access === 'owner' && !isOrdersV4ReopenDateEligible(original.documentDate)) {
      throw new BadRequestException(`تعديل الطلب متاح للطلبات المستلمة خلال آخر ${ORDERS_V4_REOPEN_WINDOW_DAYS} أيام فقط`);
    }
    if (context.access === 'cashier') {
      const recentPurchases = await tx.ordersV4Document.findMany(ordersV4CashierRecentPurchasesQuery(context.companyId));
      if (!isOrdersV4CashierReopenEligible(original.id, recentPurchases.map((document) => document.id))) {
        throw new BadRequestException(`يمكن للكاشير تعديل آخر ${ORDERS_V4_CASHIER_REOPEN_LIMIT} طلبات مستلمة فقط`);
      }
    }
    const pendingPurchase = await tx.ordersV4Document.findFirst({
      where: {
        companyId: context.companyId,
        documentType: 'purchase',
        status: 'prepared',
        reversalOfId: null,
        documentDate: { gte: original.documentDate },
      },
      select: { id: true },
    });
    if (!pendingPurchase) throw new BadRequestException('تغيرت حالة الطلب الأحدث؛ أغلق النافذة وافتح الطلب للتعديل من جديد');

    const reversal = await this.reversal.reverseInTransaction(
      tx,
      context.companyId,
      original.id,
      `correction-reversal:${context.correctionRequestHash.slice(0, 48)}`,
    );
    const inheritedPaymentMethod = original.paymentMethod === 'custody' || original.paymentMethod === 'cash' || original.paymentMethod === 'transfer'
      ? original.paymentMethod
      : null;
    const replacement = await tx.ordersV4Document.create({
      data: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        documentNumber: `REQ4-${context.receivedDate.toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
        documentType: 'purchase',
        registrationEntryType: null,
        status: 'prepared',
        paymentMethod: input.paymentMethod || inheritedPaymentMethod,
        documentDate: context.receivedDate,
        sectionId: input.sectionId || null,
        locationId: input.locationId,
        pettyCashAmount: input.pettyCashAmount == null || input.pettyCashAmount === '' ? original.pettyCashAmount : new Prisma.Decimal(input.pettyCashAmount),
        subtotal: 0,
        totalAmount: 0,
        operationalCost: 0,
        notes: input.notes?.trim() || null,
        idempotencyKey: input.idempotencyKey.trim(),
        requestHash: context.correctionRequestHash,
        calculationVersion: original.calculationVersion,
        calculationSnapshot: {
          kernelVersion: 4,
          owner: 'orders-v4-smart-edit-workflow',
          operation: 'direct-correction',
          correctedFromDocumentId: original.id,
          reversalDocumentId: reversal.id,
        },
        createdByUserId: context.userId,
        updatedByUserId: context.userId,
      },
    });
    await tx.ordersV4Document.update({
      where: { id: original.id },
      data: {
        calculationSnapshot: {
          ...((original.calculationSnapshot as Prisma.InputJsonObject | null) ?? {}),
          correctedByDocumentId: replacement.id,
          correctionReversalDocumentId: reversal.id,
        },
        updatedByUserId: context.userId,
      },
    });
    return {
      duplicate: null,
      targetId: replacement.id,
      receivedFromRevision: original.revision,
      correctionSnapshot: {
        operation: 'direct-correction',
        correctedFromDocumentId: original.id,
        reversalDocumentId: reversal.id,
      },
      inheritedPaymentMethod,
      inheritedPettyCashAmount: original.pettyCashAmount,
    };
  }
}
