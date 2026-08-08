import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { OrdersV4ReceiveInput } from './orders-v4.contracts';
import {
  ordersV4EdgeDefinitions,
  ordersV4UnitDefinitions,
  resolveOrdersV4ContextConversion,
} from './orders-v4-conversion.context';
import { ordersV4OwnedEffectEntryFilter, resolveOrdersV4EffectHead } from './orders-v4-document-effect.policy';
import { OrdersV4FundsPostingService } from './orders-v4-funds-posting.service';
import { OrdersV4LedgerPostingService } from './orders-v4-ledger-posting.service';
import {
  isOrdersV4CashierEditEligible,
  isOrdersV4OwnerEditEligible,
  isOrdersV4ReopenDateEligible,
  ORDERS_V4_CASHIER_EDIT_LIMIT,
  ORDERS_V4_REOPEN_WINDOW_DAYS,
  ordersV4CashierRecentEditablePurchasesQuery,
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
type CorrectionItem = Prisma.OrdersV4ItemGetPayload<{
  include: {
    units: true;
    sections: true;
    conversionVersions: { include: { edges: true } };
  };
}>;
type CorrectionUnit = Prisma.OrdersV4UnitGetPayload<Record<string, never>>;
type CorrectionInventoryEntry = Prisma.OrdersV4InventoryLedgerEntryGetPayload<Record<string, never>>;
type CorrectionCustodyEntry = Prisma.OrdersV4CustodyLedgerEntryGetPayload<Record<string, never>>;

export type OrdersV4CorrectionPreparation = {
  duplicate: CorrectionDocument | null;
  targetId: string;
  receivedFromRevision: number;
  correctionSnapshot: Prisma.InputJsonObject;
  inheritedPaymentMethod: 'custody' | 'cash' | 'transfer' | null;
  inheritedPettyCashAmount: Prisma.Decimal | null;
  original: CorrectionDocument | null;
};

@Injectable()
export class OrdersV4PurchaseCorrectionService {
  constructor(
    private readonly posting: OrdersV4LedgerPostingService,
    private readonly fundsPosting: OrdersV4FundsPostingService,
  ) {}

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
        original: null,
      };
    }

    const original = await tx.ordersV4Document.findFirst({
      where: { id: context.documentId, companyId: context.companyId, documentType: 'purchase', status: 'received', reversalOfId: null },
      include: {
        section: true,
        location: true,
        lines: {
          include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true },
          orderBy: { lineNumber: 'asc' },
        },
      },
    });
    if (!original) throw new BadRequestException('الطلب المستلم غير موجود أو سبق تعديله');
    if (original.revision !== input.revision) throw new BadRequestException('تم تعديل الطلب؛ أعد تحميله قبل الحفظ');
    if (context.access === 'owner' && !isOrdersV4ReopenDateEligible(original.documentDate)) {
      const recentPurchases = await tx.ordersV4Document.findMany(ordersV4CashierRecentEditablePurchasesQuery(context.companyId));
      if (!isOrdersV4OwnerEditEligible(original.id, original.documentDate, recentPurchases.map((document) => document.id))) {
        throw new BadRequestException(`تعديل الطلب متاح خلال آخر ${ORDERS_V4_REOPEN_WINDOW_DAYS} أيام أو ضمن آخر ${ORDERS_V4_CASHIER_EDIT_LIMIT} طلبات`);
      }
    } else if (context.access === 'cashier') {
      const recentPurchases = await tx.ordersV4Document.findMany(ordersV4CashierRecentEditablePurchasesQuery(context.companyId));
      if (!isOrdersV4CashierEditEligible(original.id, recentPurchases.map((document) => document.id))) {
        throw new BadRequestException(`يمكن للكاشير تعديل أو استلام آخر ${ORDERS_V4_CASHIER_EDIT_LIMIT} طلبات فقط`);
      }
    }
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
          operation: 'atomic-correction-draft',
          correctedFromDocumentId: original.id,
          correctedFromRevision: original.revision,
        },
        createdByUserId: context.userId,
        updatedByUserId: context.userId,
      },
    });
    await tx.ordersV4Document.update({
      where: { id: original.id },
      data: {
        status: 'reversed',
        calculationSnapshot: {
          ...((original.calculationSnapshot as Prisma.InputJsonObject | null) ?? {}),
          correctedByDocumentId: replacement.id,
          correctedAt: new Date().toISOString(),
          correctionPolicy: 'atomic-reverse-and-repost-on-save',
        },
        updatedByUserId: context.userId,
      },
    });
    return {
      duplicate: null,
      targetId: replacement.id,
      receivedFromRevision: original.revision,
      correctionSnapshot: {
        operation: 'atomic-correction',
        correctedFromDocumentId: original.id,
        correctedFromRevision: original.revision,
      },
      inheritedPaymentMethod,
      inheritedPettyCashAmount: original.pettyCashAmount,
      original,
    };
  }

  async loadEffectInTransaction(
    tx: OrdersV4Transaction,
    companyId: string,
    original: CorrectionDocument | null,
  ): Promise<{ inventoryEntries: CorrectionInventoryEntry[]; custodyEntries: CorrectionCustodyEntry[] }> {
    if (!original) return { inventoryEntries: [], custodyEntries: [] };
    const head = await resolveOrdersV4EffectHead(
      original,
      (documentId) => tx.ordersV4Document.findFirst({
        where: { companyId, reversalOfId: documentId },
        include: {
          section: true,
          location: true,
          lines: {
            include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true },
            orderBy: { lineNumber: 'asc' },
          },
        },
      }),
    );
    const owned = ordersV4OwnedEffectEntryFilter(head);
    const inventoryEntries = await tx.ordersV4InventoryLedgerEntry.findMany({
      where: { companyId, sourceId: head.id, ...owned },
      orderBy: { sequence: 'desc' },
    });
    const custodyEntries = await tx.ordersV4CustodyLedgerEntry.findMany({
      where: { companyId, documentId: head.id, ...owned },
      orderBy: { sequence: 'asc' },
    });
    return { inventoryEntries, custodyEntries };
  }

  async reverseInventoryInTransaction(
    tx: OrdersV4Transaction,
    context: {
      tenantId: string;
      companyId: string;
      targetId: string;
      effectiveAt: Date;
      entries: CorrectionInventoryEntry[];
      items: CorrectionItem[];
      units: CorrectionUnit[];
    },
  ) {
    if (context.entries.length === 0) return;
    const conversionIds = [...new Set(context.entries
      .map((entry) => entry.conversionVersionId)
      .filter(Boolean) as string[])];
    const historical = await tx.ordersV4ConversionVersion.findMany({
      where: { companyId: context.companyId, id: { in: conversionIds } },
      include: { edges: true },
    });
    const itemById = new Map(context.items.map((item) => [item.id, item]));
    const unitDefinitions = ordersV4UnitDefinitions(context.units);
    for (const entry of context.entries) {
      const item = itemById.get(entry.itemId);
      if (!item) throw new BadRequestException('تعذر العثور على صنف قيد المخزون السابق');
      const currentDefinition = item.conversionVersions[0];
      const historicalDefinition = historical.find((version) => version.id === entry.conversionVersionId);
      const currentConversion = resolveOrdersV4ContextConversion({
        fromUnitId: entry.inventoryUnitId,
        toUnitId: item.kernelUnitId,
        units: unitDefinitions,
        edges: ordersV4EdgeDefinitions(historicalDefinition?.edges ?? currentDefinition?.edges),
      });
      await this.posting.postReversal(tx, {
        tenantId: context.tenantId,
        companyId: context.companyId,
        sourceId: context.targetId,
        effectiveAt: context.effectiveAt,
        currentInventoryUnitId: item.kernelUnitId,
        currentConversionVersionId: historicalDefinition?.id ?? currentDefinition?.id ?? null,
        currentConversion,
        original: entry,
      });
    }
  }

  async reverseCustodyInTransaction(
    tx: OrdersV4Transaction,
    context: {
      tenantId: string;
      companyId: string;
      targetId: string;
      effectiveAt: Date;
      entries: CorrectionCustodyEntry[];
    },
  ) {
    if (context.entries.length === 0) return;
    await this.fundsPosting.postReversals(tx, {
      tenantId: context.tenantId,
      companyId: context.companyId,
      reversalDocumentId: context.targetId,
      effectiveAt: context.effectiveAt,
      originals: context.entries,
    });
  }

  async refreshHistoricalPricesInTransaction(
    tx: OrdersV4Transaction,
    companyId: string,
    original: CorrectionDocument | null,
  ) {
    if (!original) return;
    const keys = [...new Map(original.lines.map((line) => [
      `${line.itemId}:${line.priceUnitId}`,
      { itemId: line.itemId, unitId: line.priceUnitId },
    ])).values()];
    for (const key of keys) {
      const latest = await tx.ordersV4PriceHistory.findFirst({
        where: { companyId, itemId: key.itemId, unitId: key.unitId, document: { status: 'received' } },
        orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
      });
      await tx.ordersV4ItemUnit.updateMany({
        where: { companyId, itemId: key.itemId, unitId: key.unitId },
        data: { lastPrice: latest?.unitPrice ?? null, lastPriceAt: latest?.effectiveAt ?? null },
      });
    }
  }
}
