import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { OrdersV4DocumentInput } from './orders-v4.contracts';
import { OrdersV4DocumentReversalService } from './orders-v4-document-reversal.service';
import { ordersV4DocumentEffectLockKey, ordersV4PurchaseWindowLockKey } from './orders-v4-document-effect.policy';
import {
  ordersV4OperationKeyHash,
  ordersV4RequestHash,
  persistOrdersV4OperationReplay,
  readOrdersV4OperationReplay,
} from './orders-v4-operation-idempotency.util';

type ReplacementDocument = {
  id: string;
  documentNumber: string;
  calculationSnapshot: Prisma.JsonValue;
};

type CreateRegistration = (
  companyId: string,
  input: OrdersV4DocumentInput,
  dateAccess: 'owner',
  transaction: Prisma.TransactionClient,
) => Promise<ReplacementDocument>;

export async function correctOrdersV4Registration({
  prisma,
  reversal,
  createRegistration,
  companyId,
  id,
  input,
}: {
  prisma: TenantPrismaService;
  reversal: OrdersV4DocumentReversalService;
  createRegistration: CreateRegistration;
  companyId: string;
  id: string;
  input: OrdersV4DocumentInput & { revision: number };
}) {
  const tenantId = TenantContext.getTenantId();
  const userId = TenantContext.getUserId();
  const { revision, ...documentInput } = input;
  if (!Number.isInteger(revision) || revision < 1) throw new BadRequestException('رقم مراجعة التسجيل غير صالح');
  if (documentInput.documentType !== 'registration' || documentInput.registrationEntryType === 'cancellation') {
    throw new BadRequestException('يمكن تصحيح التسجيل الداخلي العادي فقط');
  }
  if (!documentInput.idempotencyKey?.trim()) throw new BadRequestException('مفتاح منع التكرار مطلوب');

  const requestHash = ordersV4RequestHash({ documentId: id, revision, document: documentInput });
  const operationKey = ordersV4OperationKeyHash(`registration-correction:${id}`, documentInput.idempotencyKey);
  const reverseKey = ordersV4OperationKeyHash(`registration-correction-reverse:${id}`, documentInput.idempotencyKey);
  const replacementKey = ordersV4OperationKeyHash(`registration-correction-replacement:${id}`, documentInput.idempotencyKey);

  return prisma.withTenant(async (tx) => {
    const replay = await readOrdersV4OperationReplay(tx, tenantId, companyId, operationKey);
    if (replay) {
      if (replay.requestHash !== requestHash) throw new BadRequestException('مفتاح منع التكرار مستخدم لتصحيح مختلف');
      return replay.response;
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ordersV4PurchaseWindowLockKey(companyId)}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ordersV4DocumentEffectLockKey(companyId, id)}))`;
    const original = await tx.ordersV4Document.findFirst({
      where: { id, companyId, documentType: 'registration', registrationEntryType: 'issue', status: 'received', reversalOfId: null },
    });
    if (!original) throw new BadRequestException('التسجيل غير موجود أو سبق عكسه أو تصحيحه');
    if (original.revision !== revision) throw new BadRequestException('تم تحديث التسجيل بواسطة عملية أخرى؛ أعد فتحه ثم حاول مرة أخرى');

    await reversal.reverseInTransaction(tx, companyId, id, reverseKey);
    const replacement = await createRegistration(companyId, {
      ...documentInput,
      documentType: 'registration',
      registrationEntryType: 'issue',
      idempotencyKey: replacementKey,
    }, 'owner', tx);

    const correctedAt = new Date().toISOString();
    const originalSnapshot = original.calculationSnapshot && typeof original.calculationSnapshot === 'object' && !Array.isArray(original.calculationSnapshot)
      ? original.calculationSnapshot as Prisma.InputJsonObject : {};
    const replacementSnapshot = replacement.calculationSnapshot && typeof replacement.calculationSnapshot === 'object' && !Array.isArray(replacement.calculationSnapshot)
      ? replacement.calculationSnapshot as Prisma.InputJsonObject : {};
    await Promise.all([
      tx.ordersV4Document.update({ where: { id: original.id }, data: { calculationSnapshot: { ...originalSnapshot, correctedByDocumentId: replacement.id, correctedAt, correctionPolicy: 'reverse-and-repost' }, updatedByUserId: userId } }),
      tx.ordersV4Document.update({ where: { id: replacement.id }, data: { calculationSnapshot: { ...replacementSnapshot, correctedFromDocumentId: original.id, correctedAt, correctionPolicy: 'reverse-and-repost' }, updatedByUserId: userId } }),
      tx.auditLog.create({ data: { tenantId, companyId, userId, action: 'update', entity: 'orders_v4_registration_correction', entityId: original.id, oldValue: { documentId: original.id, documentNumber: original.documentNumber, revision: original.revision }, newValue: { replacementDocumentId: replacement.id, replacementDocumentNumber: replacement.documentNumber, correctionPolicy: 'reverse-and-repost' } } }),
    ]);
    const result = await tx.ordersV4Document.findUniqueOrThrow({
      where: { id: replacement.id },
      include: { section: true, location: true, lines: { include: { item: true, inputUnit: true, baseUnit: true, priceUnit: true }, orderBy: { lineNumber: 'asc' } } },
    });
    await persistOrdersV4OperationReplay(tx, tenantId, companyId, operationKey, requestHash, result);
    return result;
  });
}
