import { Injectable }   from '@nestjs/common';
import { Prisma }        from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }  from '../common/tenant-context';

type JsonValue = Prisma.InputJsonValue;

export type AuditAction = 'create' | 'update' | 'delete' | 'cancel';

export interface AuditLogParams {
  companyId:  string;
  tenantId?:  string;   // اختياري — يُستمد من TenantContext إن لم يُمرَّر
  userId?:    string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * توثيق "تعديل فاتورة" في الـ Audit Log — شكل القيمة القديمة والجديدة للشفافية التامة:
 *
 * عند التعديل نُسجّل:
 * - oldValue: لقطة الفاتورة قبل التعديل (كل الحقول المالية والمرجعية)، مثال:
 *   { id, companyId, supplierId, invoiceNumber, kind, totalAmount, netAmount, taxAmount,
 *     transactionDate, vaultId, paymentMethodId, status, entryDate, createdAt, updatedAt }
 * - newValue: لقطة الفاتورة بعد التعديل بنفس الشكل.
 *
 * بهذا يمكن مراجعة أي تغيير (من غيّر المبلغ، من غيّر المورد، متى) دون فقدان أي معلومة.
 */
export const INVOICE_AUDIT_SNAPSHOT_FIELDS = [
  'id', 'companyId', 'supplierId', 'invoiceNumber', 'kind',
  'totalAmount', 'netAmount', 'taxAmount', 'transactionDate',
  'vaultId', 'paymentMethodId', 'batchId', 'status',
  'entryDate', 'createdAt', 'updatedAt',
] as const;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async log(params: AuditLogParams): Promise<void> {
    const { companyId, userId, action, entity, entityId, oldValue, newValue, ip, userAgent } = params;
    // tenantId: مُمرَّر صراحةً أو يُستمد من TenantContext تلقائياً
    const tenantId = params.tenantId ?? TenantContext.tryGetTenantId() ?? '';
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        companyId,
        userId:    userId    ?? undefined,
        action,
        entity,
        entityId,
        oldValue:  oldValue  as JsonValue ?? undefined,
        newValue:  newValue  as JsonValue ?? undefined,
        ip:        ip        ?? undefined,
        userAgent: userAgent ?? undefined,
      },
    });
  }

  /**
   * تسجيل إنشاء كيان (بدون قيمة قديمة).
   */
  async logCreate(
    companyId: string,
    entity: string,
    entityId: string,
    newValue: Record<string, unknown>,
    userId?: string | null,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<void> {
    await this.log({
      companyId,
      userId,
      action: 'create',
      entity,
      entityId,
      newValue,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }

  /**
   * تسجيل تعديل كيان (القيمة القديمة والجديدة) — يستخدم في "تعديل فاتورة" وغيره.
   */
  async logUpdate(
    companyId: string,
    entity: string,
    entityId: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    userId?: string | null,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<void> {
    await this.log({
      companyId,
      userId,
      action: 'update',
      entity,
      entityId,
      oldValue,
      newValue,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }

  /**
   * تسجيل حذف/إلغاء (القيمة القديمة فقط).
   */
  async logDelete(
    companyId: string,
    entity: string,
    entityId: string,
    oldValue: Record<string, unknown>,
    userId?: string | null,
    meta?: { ip?: string; userAgent?: string },
  ): Promise<void> {
    await this.log({
      companyId,
      userId,
      action: 'delete',
      entity,
      entityId,
      oldValue,
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
  }

  /**
   * استخراج لقطة فاتورة مناسبة للتدقيق (قيم قابلة لـ JSON).
   */
  static invoiceToSnapshot(invoice: {
    id: string;
    companyId: string;
    supplierId: string;
    invoiceNumber: string;
    kind: string;
    totalAmount: unknown;
    netAmount: unknown;
    taxAmount: unknown;
    transactionDate: Date;
    vaultId: string | null;
    paymentMethodId: string | null;
    batchId: string | null;
    status: string;
    entryDate: Date;
    createdAt: Date;
    updatedAt: Date;
  }): Record<string, unknown> {
    return {
      id: invoice.id,
      companyId: invoice.companyId,
      supplierId: invoice.supplierId,
      invoiceNumber: invoice.invoiceNumber,
      kind: invoice.kind,
      totalAmount: String(invoice.totalAmount),
      netAmount: String(invoice.netAmount),
      taxAmount: String(invoice.taxAmount),
      transactionDate: invoice.transactionDate.toISOString(),
      vaultId: invoice.vaultId,
      paymentMethodId: invoice.paymentMethodId,
      batchId: invoice.batchId,
      status: invoice.status,
      entryDate: invoice.entryDate.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    };
  }
}
