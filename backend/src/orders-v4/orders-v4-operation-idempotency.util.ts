import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

const ORDERS_V4_OPERATION_IDEMPOTENCY_HOURS = 24;

export type OrdersV4OperationReplay = {
  requestHash: string;
  response: Prisma.JsonValue;
};

export function ordersV4RequestHash(value: object | string): string {
  const payload = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(payload).digest('hex');
}

export function ordersV4OperationKeyHash(operation: string, idempotencyKey: string): string {
  return ordersV4RequestHash(`orders-v4:${operation}:${idempotencyKey.trim()}`);
}

export function ordersV4OperationExpiry(now = new Date()): Date {
  return new Date(now.getTime() + ORDERS_V4_OPERATION_IDEMPOTENCY_HOURS * 60 * 60 * 1000);
}

export function ordersV4SerializeJson(value: unknown): Prisma.JsonValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(ordersV4SerializeJson);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, ordersV4SerializeJson(entry)]),
    );
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

export function ordersV4OperationReplay(value: Prisma.JsonValue | null): OrdersV4OperationReplay | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const requestHash = value.requestHash;
  if (typeof requestHash !== 'string' || !Object.prototype.hasOwnProperty.call(value, 'response')) return null;
  return { requestHash, response: value.response ?? null };
}

type OrdersV4OperationIdempotencyClient = Pick<Prisma.TransactionClient, 'idempotencyKey'>;

export async function readOrdersV4OperationReplay(
  tx: OrdersV4OperationIdempotencyClient,
  tenantId: string,
  companyId: string,
  keyHash: string,
): Promise<OrdersV4OperationReplay | null> {
  const cached = await tx.idempotencyKey.findFirst({
    where: { tenantId, companyId, keyHash, expiresAt: { gt: new Date() } },
  });
  return ordersV4OperationReplay(cached?.resultJson ?? null);
}

export function persistOrdersV4OperationReplay(
  tx: OrdersV4OperationIdempotencyClient,
  tenantId: string,
  companyId: string,
  keyHash: string,
  requestHash: string,
  response: unknown,
) {
  const resultJson = { requestHash, response: ordersV4SerializeJson(response) };
  const expiresAt = ordersV4OperationExpiry();
  return tx.idempotencyKey.upsert({
    where: { companyId_keyHash: { companyId, keyHash } },
    create: { tenantId, companyId, keyHash, resultJson, expiresAt },
    update: { resultJson, expiresAt },
  });
}
