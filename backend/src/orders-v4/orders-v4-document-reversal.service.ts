import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ordersV4EdgeDefinitions, ordersV4UnitDefinitions, resolveOrdersV4ContextConversion } from './orders-v4-conversion.context';
import { OrdersV4FundsPostingService } from './orders-v4-funds-posting.service';
import { OrdersV4LedgerPostingService } from './orders-v4-ledger-posting.service';
import {
  ordersV4DocumentEffectLockKey,
  ordersV4OwnedEffectEntryFilter,
  ordersV4PurchaseWindowLockKey,
  resolveOrdersV4EffectHead,
} from './orders-v4-document-effect.policy';
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

function operationHash(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function snapshotObject(value: Prisma.JsonValue): Prisma.InputJsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Prisma.InputJsonObject
    : {};
}

@Injectable()
export class OrdersV4DocumentReversalService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly posting: OrdersV4LedgerPostingService,
    private readonly fundsPosting: OrdersV4FundsPostingService,
  ) {}

  reverse(companyId: string, id: string, idempotencyKey: string) {
    return this.toggle(companyId, id, idempotencyKey, false);
  }

  undoReverse(companyId: string, id: string, idempotencyKey: string) {
    return this.toggle(companyId, id, idempotencyKey, true);
  }

  async reopenPurchase(companyId: string, id: string, idempotencyKey: string, access: OrdersV4ReopenAccess = 'owner') {
    if (!idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    return this.prisma.withTenant(async (tx) => {
      const purchase = await tx.ordersV4Document.findFirst({
        where: { id, companyId, documentType: 'purchase', reversalOfId: null },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
      if (!purchase) throw new NotFoundException('طلب الشراء غير موجود');
      if (purchase.status !== 'received') throw new BadRequestException('يمكن إعادة فتح الطلب المستلم فقط');
      if (access === 'owner' && !isOrdersV4ReopenDateEligible(purchase.documentDate)) {
        const recentPurchases = await tx.ordersV4Document.findMany(ordersV4CashierRecentEditablePurchasesQuery(companyId));
        if (!isOrdersV4OwnerEditEligible(purchase.id, purchase.documentDate, recentPurchases.map((document) => document.id))) {
          throw new BadRequestException(`إعادة الفتح متاحة خلال آخر ${ORDERS_V4_REOPEN_WINDOW_DAYS} أيام أو ضمن آخر ${ORDERS_V4_CASHIER_EDIT_LIMIT} طلبات`);
        }
      } else if (access === 'cashier') {
        const recentPurchases = await tx.ordersV4Document.findMany(ordersV4CashierRecentEditablePurchasesQuery(companyId));
        if (!isOrdersV4CashierEditEligible(purchase.id, recentPurchases.map((document) => document.id))) {
          throw new BadRequestException(`يمكن للكاشير تعديل أو استلام آخر ${ORDERS_V4_CASHIER_EDIT_LIMIT} طلبات فقط`);
        }
      }
      // Opening the editor is deliberately read-only. Inventory, custody and
      // price differences are posted atomically only when the edited document
      // is saved through receivePurchase(editMode=correction).
      const editablePurchase = await tx.ordersV4Document.findUniqueOrThrow({
        where: { id: purchase.id },
        include: {
          section: true,
          location: true,
          lines: {
            include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true },
            orderBy: { lineNumber: 'asc' },
          },
        },
      });
      return { ...editablePurchase, editMode: 'correction' as const };

    });
  }

  private toggle(companyId: string, id: string, idempotencyKey: string, undo: boolean) {
    if (!idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    return this.prisma.withTenant(async (tx) => {
      // Correction, cancellation and restoration share one outer lock. This
      // prevents two transitions from reading the same received revision and
      // both reversing its economic effect. The per-document lock comes next.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ordersV4PurchaseWindowLockKey(companyId)}))`;
      return this.toggleInTransaction(tx, companyId, id, idempotencyKey.trim(), undo);
    });
  }

  private async toggleInTransaction(
    tx: OrdersV4Transaction,
    companyId: string,
    id: string,
    idempotencyKey: string,
    undo: boolean,
  ) {
    const tenantId = TenantContext.getTenantId();
    const operation = undo ? 'undo-reverse' : 'reverse';
    const reversalRequestHash = operationHash({ operation, documentId: id });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ordersV4DocumentEffectLockKey(companyId, id)}))`;
    const duplicate = await tx.ordersV4Document.findFirst({ where: { companyId, idempotencyKey } });
    if (duplicate) {
      if (duplicate.requestHash !== reversalRequestHash) throw new BadRequestException('مفتاح منع التكرار مستخدم لعملية مختلفة');
      return duplicate;
    }
    const original = await tx.ordersV4Document.findFirst({
      where: { id, companyId, status: undo ? 'reversed' : 'received', reversalOfId: null }, include: { lines: true },
    });
    if (!original) throw new NotFoundException(undo ? 'المستند غير موجود أو لم يتم عكسه' : 'المستند غير موجود أو سبق عكسه');
    const originalSnapshot = snapshotObject(original.calculationSnapshot);
    if (undo && (originalSnapshot.reopenedByDocumentId || originalSnapshot.correctedByDocumentId)) {
      throw new BadRequestException('لا يمكن استعادة نسخة قديمة بعد إنشاء طلب تصحيح بديل');
    }
    if (original.documentType === 'registration' && original.sectionId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:registration-cancellation:${companyId}:${original.documentDate.toISOString()}:${original.sectionId}:${original.locationId}`}))`;
    }
    const chainHead = await resolveOrdersV4EffectHead(
      original,
      (documentId) => tx.ordersV4Document.findFirst({
        where: { companyId, reversalOfId: documentId },
        include: { lines: true },
      }),
    );
    const ownedEffectFilter = ordersV4OwnedEffectEntryFilter(chainHead);
    const originalLedger = await tx.ordersV4InventoryLedgerEntry.findMany({
      where: {
        companyId,
        sourceId: chainHead.id,
        ...ownedEffectFilter,
      },
      orderBy: { sequence: 'desc' },
    });
    const ledgerItemIds = [...new Set(originalLedger.map((entry) => entry.itemId))];
    const historicalConversionIds = [...new Set(originalLedger.map((entry) => entry.conversionVersionId).filter(Boolean) as string[])];
    const [ledgerItems, companyUnits, historicalConversions] = await Promise.all([
      tx.ordersV4Item.findMany({
        where: { companyId, id: { in: ledgerItemIds } },
        include: { conversionVersions: { where: { status: 'published' }, orderBy: { version: 'desc' }, take: 1, include: { edges: true } } },
      }),
      tx.ordersV4Unit.findMany({ where: { companyId } }),
      tx.ordersV4ConversionVersion.findMany({ where: { companyId, id: { in: historicalConversionIds } }, include: { edges: true } }),
    ]);
    const unitDefinitions = ordersV4UnitDefinitions(companyUnits);
    const originalCustody = await tx.ordersV4CustodyLedgerEntry.findMany({
      where: {
        companyId,
        documentId: chainHead.id,
        ...ownedEffectFilter,
      },
      orderBy: { sequence: 'asc' },
    });
    await this.posting.lockKeys(tx, companyId, originalLedger.map((entry) => ({ itemId: entry.itemId, locationId: entry.locationId })));
    const reversal = await tx.ordersV4Document.create({
      data: {
        tenantId, companyId,
        documentNumber: `${original.documentNumber}-${undo ? 'UNDO' : 'R'}-${randomUUID().slice(0, 8).toUpperCase()}`,
        documentType: original.documentType,
        registrationEntryType: original.registrationEntryType,
        paymentMethod: original.paymentMethod,
        documentDate: new Date(), status: 'reversed', sectionId: original.sectionId,
        locationId: original.locationId, pettyCashAmount: chainHead.pettyCashAmount?.negated() ?? null,
        subtotal: chainHead.subtotal.negated(), totalAmount: chainHead.totalAmount.negated(),
        operationalCost: chainHead.operationalCost.negated(),
        notes: undo ? `إلغاء عكس ${original.documentNumber}` : `عكس ${original.documentNumber}`,
        idempotencyKey,
        requestHash: reversalRequestHash,
        calculationVersion: 1,
        calculationSnapshot: {
          kernelVersion: 4, operation, rootDocumentId: original.id,
          reversalOfId: chainHead.id, operationalCost: chainHead.operationalCost.negated().toString(),
        },
        reversalOfId: chainHead.id, createdByUserId: TenantContext.getUserId(),
      },
    });
    const reversedAt = new Date();
    for (const entry of originalLedger) {
      const item = ledgerItems.find((row) => row.id === entry.itemId);
      if (!item) throw new BadRequestException('تعذر العثور على صنف قيد المخزون المراد عكسه');
      const definition = item.conversionVersions[0];
      const historicalDefinition = historicalConversions.find((row) => row.id === entry.conversionVersionId);
      const currentConversion = resolveOrdersV4ContextConversion({
        fromUnitId: entry.inventoryUnitId,
        toUnitId: item.kernelUnitId,
        units: unitDefinitions,
        edges: ordersV4EdgeDefinitions(historicalDefinition?.edges ?? definition?.edges),
      });
      await this.posting.postReversal(tx, {
        tenantId, companyId, sourceId: reversal.id, effectiveAt: reversedAt,
        currentInventoryUnitId: item.kernelUnitId,
        currentConversionVersionId: historicalDefinition?.id ?? definition?.id ?? null,
        currentConversion, original: entry,
      });
    }
    if (originalCustody.length) {
      await this.fundsPosting.postReversals(tx, {
        tenantId, companyId, reversalDocumentId: reversal.id, effectiveAt: reversedAt, originals: originalCustody,
      });
    }
    await tx.ordersV4Document.update({
      where: { id: original.id },
      data: { status: undo ? 'received' : 'reversed', updatedByUserId: TenantContext.getUserId() },
    });
    for (const line of original.lines) {
      const latestPrice = await tx.ordersV4PriceHistory.findFirst({
        where: { companyId, itemId: line.itemId, unitId: line.priceUnitId, document: { status: 'received' } },
        orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
      });
      await tx.ordersV4ItemUnit.updateMany({
        where: { companyId, itemId: line.itemId, unitId: line.priceUnitId },
        data: { lastPrice: latestPrice?.unitPrice ?? null, lastPriceAt: latestPrice?.effectiveAt ?? null },
      });
    }
    return reversal;
  }
}
