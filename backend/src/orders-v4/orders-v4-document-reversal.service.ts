import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ordersV4EdgeDefinitions, ordersV4UnitDefinitions, resolveOrdersV4ContextConversion } from './orders-v4-conversion.context';
import { OrdersV4FundsPostingService } from './orders-v4-funds-posting.service';
import { OrdersV4LedgerPostingService } from './orders-v4-ledger-posting.service';
import {
  isOrdersV4CashierReopenEligible,
  isOrdersV4ReopenDateEligible,
  ORDERS_V4_CASHIER_REOPEN_LIMIT,
  ORDERS_V4_REOPEN_WINDOW_DAYS,
  ordersV4CashierRecentPurchasesQuery,
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

function purchaseDocumentNumber(date: Date): string {
  return `REQ4-${date.toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
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
    const normalizedKey = idempotencyKey.trim();
    const reopenRequestHash = operationHash({ operation: 'reopen-purchase', documentId: id });
    const tenantId = TenantContext.getTenantId();
    const userId = TenantContext.getUserId();

    return this.prisma.withTenant(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:receive:${companyId}`}))`;
      const duplicate = await tx.ordersV4Document.findFirst({
        where: { companyId, idempotencyKey: normalizedKey },
        include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
      });
      if (duplicate) {
        if (duplicate.requestHash !== reopenRequestHash) throw new BadRequestException('مفتاح منع التكرار مستخدم لعملية مختلفة');
        return duplicate;
      }

      const purchase = await tx.ordersV4Document.findFirst({
        where: { id, companyId, documentType: 'purchase', reversalOfId: null },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
      if (!purchase) throw new NotFoundException('طلب الشراء غير موجود');
      if (purchase.status !== 'received') throw new BadRequestException('يمكن إعادة فتح الطلب المستلم فقط');
      if (access === 'owner' && !isOrdersV4ReopenDateEligible(purchase.documentDate)) {
        throw new BadRequestException(`إعادة الفتح متاحة للطلبات المستلمة خلال آخر ${ORDERS_V4_REOPEN_WINDOW_DAYS} أيام فقط`);
      }
      if (access === 'cashier') {
        const recentPurchases = await tx.ordersV4Document.findMany(ordersV4CashierRecentPurchasesQuery(companyId));
        if (!isOrdersV4CashierReopenEligible(purchase.id, recentPurchases.map((document) => document.id))) {
          throw new BadRequestException(`يمكن للكاشير تعديل آخر ${ORDERS_V4_CASHIER_REOPEN_LIMIT} طلبات مستلمة فقط`);
        }
      }
      const pendingPurchase = await tx.ordersV4Document.findFirst({
        where: { companyId, documentType: 'purchase', status: 'prepared', reversalOfId: null },
        select: { id: true },
      });
      if (pendingPurchase) throw new BadRequestException('يوجد طلب بانتظار الاستلام؛ استلمه قبل إعادة فتح طلب آخر');

      const reversalKey = `reopen-reversal:${reopenRequestHash.slice(0, 48)}`;
      const reversal = await this.toggleInTransaction(tx, companyId, id, reversalKey, false);
      const replacement = await tx.ordersV4Document.create({
        data: {
          tenantId,
          companyId,
          documentNumber: purchaseDocumentNumber(purchase.documentDate),
          documentType: 'purchase',
          registrationEntryType: null,
          status: 'prepared',
          paymentMethod: purchase.paymentMethod,
          documentDate: purchase.documentDate,
          sectionId: purchase.sectionId,
          locationId: purchase.locationId,
          pettyCashAmount: purchase.pettyCashAmount,
          subtotal: purchase.subtotal,
          totalAmount: purchase.totalAmount,
          operationalCost: purchase.operationalCost,
          notes: purchase.notes,
          idempotencyKey: normalizedKey,
          requestHash: reopenRequestHash,
          calculationVersion: purchase.calculationVersion,
          calculationSnapshot: {
            kernelVersion: 4,
            owner: 'orders-v4-reopen-workflow',
            operation: 'reopen-replacement',
            reopenedFromDocumentId: purchase.id,
            reversalDocumentId: reversal.id,
            lineCount: purchase.lines.length,
          },
          createdByUserId: userId,
          updatedByUserId: userId,
        },
      });

      for (const line of purchase.lines) {
        await tx.ordersV4DocumentLine.create({
          data: {
            tenantId,
            companyId,
            documentId: replacement.id,
            itemId: line.itemId,
            lineNumber: line.lineNumber,
            itemNameSnapshot: line.itemNameSnapshot,
            inputQuantity: line.inputQuantity,
            inputUnitId: line.inputUnitId,
            baseQuantity: line.baseQuantity,
            baseUnitId: line.baseUnitId,
            unitPrice: line.unitPrice,
            priceUnitId: line.priceUnitId,
            priceQuantity: line.priceQuantity,
            lineTotal: line.lineTotal,
            operationalCost: line.operationalCost,
            conversionVersionId: line.conversionVersionId,
            recipeVersionId: line.recipeVersionId,
            cancellationReasons: line.cancellationReasons == null ? Prisma.JsonNull : line.cancellationReasons as Prisma.InputJsonValue,
            cancellationNote: line.cancellationNote,
            conversionSnapshot: line.conversionSnapshot as Prisma.InputJsonObject,
            recipeSnapshot: line.recipeSnapshot == null ? Prisma.JsonNull : line.recipeSnapshot as Prisma.InputJsonValue,
            costSnapshot: line.costSnapshot == null ? Prisma.JsonNull : line.costSnapshot as Prisma.InputJsonValue,
            calculationSnapshot: {
              ...snapshotObject(line.calculationSnapshot),
              reopenedFromLineId: line.id,
            },
          },
        });
      }

      await tx.ordersV4Document.update({
        where: { id: purchase.id },
        data: {
          calculationSnapshot: {
            ...snapshotObject(purchase.calculationSnapshot),
            reopenedByDocumentId: replacement.id,
            reopenReversalDocumentId: reversal.id,
          },
          updatedByUserId: userId,
        },
      });

      return tx.ordersV4Document.findUniqueOrThrow({
        where: { id: replacement.id },
        include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
      });
    });
  }

  private toggle(companyId: string, id: string, idempotencyKey: string, undo: boolean) {
    if (!idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');
    return this.prisma.withTenant((tx) => this.toggleInTransaction(tx, companyId, id, idempotencyKey.trim(), undo));
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
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:reverse:${companyId}:${id}`}))`;
    const duplicate = await tx.ordersV4Document.findFirst({ where: { companyId, idempotencyKey } });
    if (duplicate) {
      if (duplicate.requestHash !== reversalRequestHash) throw new BadRequestException('مفتاح منع التكرار مستخدم لعملية مختلفة');
      return duplicate;
    }
    const original = await tx.ordersV4Document.findFirst({
      where: { id, companyId, status: undo ? 'reversed' : 'received', reversalOfId: null }, include: { lines: true },
    });
    if (!original) throw new NotFoundException(undo ? 'المستند غير موجود أو لم يتم عكسه' : 'المستند غير موجود أو سبق عكسه');
    if (undo && snapshotObject(original.calculationSnapshot).reopenedByDocumentId) {
      throw new BadRequestException('لا يمكن إلغاء عكس طلب أعيد فتحه؛ عدّل الطلب البديل ثم استلمه');
    }
    if (original.documentType === 'registration' && original.sectionId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`orders-v4:registration-cancellation:${companyId}:${original.documentDate.toISOString()}:${original.sectionId}:${original.locationId}`}))`;
    }
    let chainHead = original;
    const visited = new Set<string>([original.id]);
    while (true) {
      const next = await tx.ordersV4Document.findFirst({ where: { companyId, reversalOfId: chainHead.id }, include: { lines: true } });
      if (!next) break;
      if (visited.has(next.id)) throw new BadRequestException('تم اكتشاف دورة غير صالحة في سلسلة العكس');
      visited.add(next.id);
      chainHead = next;
    }
    const originalLedger = await tx.ordersV4InventoryLedgerEntry.findMany({
      where: { companyId, sourceId: chainHead.id }, orderBy: { sequence: 'desc' },
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
      where: { companyId, documentId: chainHead.id }, orderBy: { sequence: 'asc' },
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
