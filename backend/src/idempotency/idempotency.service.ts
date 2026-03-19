/**
 * IdempotencyService — منع تنفيذ نفس العملية مرتين
 *
 * يُستخدم مع processInflow عند تمرير idempotencyKey من الواجهة.
 * يُخزّن النتيجة بشكل آمن مع تحويل Decimal و Date إلى قيم قابلة للتسلسل.
 */
import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

const TTL_HOURS = 24;

/** تحويل نتيجة العملية إلى JSON آمن للتخزين (Decimal → string، Date → ISO) */
function serializeForStorage(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Prisma.Decimal) return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeForStorage);
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = serializeForStorage(v);
    }
    return out;
  }
  return obj;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: TenantPrismaService) {}

  hashKey(operationType: string, payload: Record<string, unknown>): string {
    const str = `${operationType}:${JSON.stringify(payload)}`;
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  async getCachedResult(
    tenantId: string,
    companyId: string,
    keyHash: string,
  ): Promise<unknown | null> {
    const row = await this.prisma.idempotencyKey.findFirst({
      where: { tenantId, companyId, keyHash },
    });
    if (!row || new Date() > row.expiresAt) return null;
    return row.resultJson as unknown;
  }

  /**
   * حذف مفاتيح عدم التكرار المنتهية (expiresAt < now).
   * يُستدعى من Cron كل ساعة — يستخدم PrismaService لتجاوز RLS (تنظيف شامل).
   * لا نطرح ساعات إضافية لأن expiresAt يمثل بالفعل حد انتهاء الصلاحية.
   */
  async cleanupExpiredKeys(prisma: { idempotencyKey: { deleteMany: (args: unknown) => Promise<{ count: number }> } }): Promise<number> {
    const result = await prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  async storeResult(
    tenantId: string,
    companyId: string,
    keyHash: string,
    result: unknown,
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TTL_HOURS);
    const serialized = serializeForStorage(result) as Prisma.InputJsonValue;

    await this.prisma.idempotencyKey.upsert({
      where: { companyId_keyHash: { companyId, keyHash } },
      create: {
        tenantId,
        companyId,
        keyHash,
        resultJson: serialized,
        expiresAt,
      },
      update: {
        resultJson: serialized,
        expiresAt,
      },
    });
  }
}
