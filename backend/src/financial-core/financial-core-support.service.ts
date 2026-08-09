/**
 * دعم مشترك: إعادة محاولة، تسوية خزنات/حسابات، ومساعدات المستخدم/السياق
 */
import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { nowSaudi } from '../common/utils/date-utils';
import { sleep, getRetryDelayMs, RETRY_MAX, type JsonObject, type TxClient } from './financial-core-helpers.util';
import { OutflowDto } from './dto/financial-operation.dto';

@Injectable()
export class FinancialCoreSupportService {

  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < RETRY_MAX; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        const code = (e as { code?: string })?.code;
        if (code === 'P2034' && i < RETRY_MAX - 1) {
          await sleep(getRetryDelayMs(i));
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  }

  // ══════════════════════════════════════════════════════════
  // PRIVATE: Account Resolution (مركزي — لا تكرار)
  // ══════════════════════════════════════════════════════════

  /** قنوات المبيعات: يكفي أن تكون الخزنة مفعّلة كقناة بيع وغير مؤرشفة */
  async assertVaultsUsableAsSalesPayment(tx: TxClient, companyId: string, vaultIds: string[]) {
    const ids = [...new Set(vaultIds.filter(Boolean))];
    if (!ids.length) return;
    const vaults = await tx.vault.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true, nameAr: true, isActive: true, isSalesChannel: true, isArchived: true },
    });
    const byId = new Map(vaults.map((v) => [v.id, v]));
    for (const id of ids) {
      const v = byId.get(id);
      if (!v) {
        throw new NotFoundException(`الخزنة غير موجودة أو لا تنتمي لهذه الشركة`);
      }
      if (v.isActive === false) {
        throw new BadRequestException(`الخزينة «${v.nameAr}» غير نشطة ولا يمكن استخدامها في المبيعات.`);
      }
      if (v.isArchived) {
        throw new BadRequestException(`الخزينة «${v.nameAr}» مؤرشفة ولا يمكن استخدامها في المبيعات.`);
      }
      if (!v.isSalesChannel) {
        throw new BadRequestException(`الخزينة «${v.nameAr}» ليست قناة بيع مفعّلة.`);
      }
    }
  }

  /**
   * يحلّ خزنة/خزائن السداد: vaultSplits (مجموعها = الإجمالي)، أو vaultId، أو خزنة السداد الافتراضية.
   * يدمج صفوفاً مكررة لنفس الخزنة.
   */
  async resolveOutflowVaultSplits(
    tx: TxClient,
    companyId: string,
    dto: OutflowDto,
  ): Promise<Array<{ vaultId: string; amount: Prisma.Decimal }>> {
    const total = new Prisma.Decimal(String(dto.totalAmount));

    if (dto.vaultSplits != null && dto.vaultSplits.length > 0) {
      const merged = new Map<string, Prisma.Decimal>();
      for (const s of dto.vaultSplits) {
        const vid = (s.vaultId || '').trim();
        if (!vid) {
          throw new BadRequestException('معرف الخزنة مطلوب في كل جزء من توزيع السداد');
        }
        const amt = new Prisma.Decimal(String(s.amount));
        if (amt.lte(0)) {
          throw new BadRequestException('كل جزء من توزيع الخزائن يجب أن يكون أكبر من صفر');
        }
        merged.set(vid, (merged.get(vid) ?? new Prisma.Decimal(0)).plus(amt));
      }
      const splits = [...merged.entries()].map(([vaultId, amount]) => ({ vaultId, amount }));
      const sum = splits.reduce((acc, x) => acc.plus(x.amount), new Prisma.Decimal(0));
      if (!sum.equals(total)) {
        throw new BadRequestException(
          `مجموع توزيع الخزائن (${sum.toFixed(4)}) يجب أن يساوي إجمالي الفاتورة (${total.toFixed(4)})`,
        );
      }
      for (const s of splits) {
        await this.assertVaultUsableForPaymentOutflow(tx, companyId, s.vaultId);
      }
      return splits;
    }

    if (dto.vaultId) {
      await this.assertVaultUsableForPaymentOutflow(tx, companyId, dto.vaultId);
      return [{ vaultId: dto.vaultId, amount: total }];
    }

    const defaultVault = await tx.vault.findFirst({
      where:   { companyId, isActive: true, isArchived: false, showAsPaymentMethod: true },
      select:  { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!defaultVault) {
      throw new BadRequestException(
        `لا توجد خزينة متاحة للسداد للشركة ${companyId}. أضف خزينة أو فعّل «الظهور كطريقة سداد» من شاشة الخزائن.`,
      );
    }
    await this.assertVaultUsableForPaymentOutflow(tx, companyId, defaultVault.id);
    return [{ vaultId: defaultVault.id, amount: total }];
  }

  /** تحويل بين خزائن: الطرفان نشطان غير مؤرشفين وتابعان للشركة (لا يشترط showAsPaymentMethod — عهدة/صناديق مخفية عن السداد). */
  async assertVaultTransferEndpoints(
    tx: TxClient,
    companyId: string,
    fromVaultId: string,
    toVaultId: string,
  ) {
    const ids = [fromVaultId, toVaultId];
    const vaults = await tx.vault.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true, nameAr: true, isActive: true, isArchived: true },
    });
    const byId = new Map(vaults.map((v) => [v.id, v]));
    for (const vid of ids) {
      const v = byId.get(vid);
      if (!v) {
        throw new NotFoundException(`الخزنة ${vid} غير موجودة أو لا تنتمي لهذه الشركة`);
      }
      if (v.isArchived) {
        throw new BadRequestException(`الخزينة «${v.nameAr}» مؤرشفة ولا يمكن التحويل منها أو إليها.`);
      }
      if (v.isActive === false) {
        throw new BadRequestException(`الخزينة «${v.nameAr}» غير نشطة.`);
      }
    }
  }

  /**
   * Accounting reversals remain valid after an endpoint is archived or disabled.
   * They require only that both historical vault identities still belong to the
   * company; operational create rules intentionally do not apply.
   */
  async assertVaultTransferReversalEndpoints(
    tx: TxClient,
    companyId: string,
    fromVaultId: string,
    toVaultId: string,
  ) {
    const ids = [fromVaultId, toVaultId];
    const vaults = await tx.vault.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true },
    });
    const found = new Set(vaults.map((vault) => vault.id));
    for (const id of ids) {
      if (!found.has(id)) {
        throw new NotFoundException(`الخزينة ${id} غير موجودة أو لا تنتمي لهذه الشركة`);
      }
    }
  }

  /** أي صرف (مشتريات، مصاريف، رواتب، سلف، …): خزنة غير مؤرشفة ومفعّل لها الظهور كسداد */
  async assertVaultUsableForPaymentOutflow(tx: TxClient, companyId: string, vaultId: string) {
    const v = await tx.vault.findFirst({
      where: { id: vaultId, companyId },
      select: { id: true, nameAr: true, isActive: true, showAsPaymentMethod: true, isArchived: true },
    });
    if (!v) {
      throw new NotFoundException(`الخزنة غير موجودة أو لا تنتمي لهذه الشركة`);
    }
    if (v.isActive === false) {
      throw new BadRequestException(`الخزينة «${v.nameAr}» غير نشطة ولا يمكن السداد منها.`);
    }
    if (v.isArchived) {
      throw new BadRequestException(`الخزينة «${v.nameAr}» مؤرشفة ولا يمكن السداد منها.`);
    }
    if (v.showAsPaymentMethod === false) {
      throw new BadRequestException(
        `الخزينة «${v.nameAr}» غير متاحة للسداد. فعّل «الظهور كطريقة سداد» من شاشة الخزائن.`,
      );
    }
  }

  async getVaultAccount(tx: TxClient, companyId: string, vaultId?: string): Promise<string> {
    if (!vaultId) {
      // إذا لم تُحدَّد الخزنة، جلب أول خزينة نشطة مفعّل لها السداد في الواجهة
      const defaultVault = await tx.vault.findFirst({
        where:   { companyId, isActive: true, isArchived: false, showAsPaymentMethod: true },
        select:  { accountId: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!defaultVault) {
        throw new BadRequestException(
          `لا توجد خزينة متاحة للسداد للشركة ${companyId}. أضف خزينة أو فعّل «الظهور كطريقة سداد» من شاشة الخزائن.`,
        );
      }
      return defaultVault.accountId;
    }

    const vault = await tx.vault.findFirst({
      where:  { id: vaultId, companyId },
      select: { accountId: true },
    });
    if (!vault) {
      throw new NotFoundException(`الخزنة ${vaultId} غير موجودة أو لا تنتمي لهذه الشركة`);
    }
    return vault.accountId;
  }

  /**
   * خريطة صريحة: نوع العملية → كود الحساب المحاسبي.
   *
   * الأكواد مُطابِقة لما يُنشئه accounting-init.service.ts:
   *   PUR-001 → مواد غذائية           (purchase)
   *   EXP-002 → رسوم حكومية وإقامات  (hr_expense)
   *   EXP-003 → إيجار ومرافق         (fixed_expense)
   *   EXP-004 → رواتب وأجور          (salary)
   *   ADV-001 → سلف الموظفين          (advance)
   *   EXP-005 → صيانة وتشغيل         (expense — مصروفات عامة / fallback)
   *
   * السلفة أصل على الموظف حتى تُقفل من مسير راتبه؛ لا تدخل P&L وقت الصرف.
   * لإضافة نوع جديد: أضف الكود هنا وتأكد من وجوده في accounting-init.service.ts.
   */
  static readonly KIND_TO_ACCOUNT_CODE: Record<string, string> = {
    purchase:      'PUR-001',   // مواد غذائية (مشتريات)
    expense:       'EXP-005',   // صيانة وتشغيل (مصروفات عامة)
    hr_expense:    'EXP-002',   // رسوم حكومية وإقامات
    fixed_expense: 'EXP-003',   // إيجار ومرافق
    salary:        'EXP-004',   // رواتب وأجور
    advance:       'ADV-001',   // سلفة موظف = أصل يُسوّى مع الراتب
  };

  /**
   * يُحدد الحساب المدين بدقة باستخدام الخريطة الصريحة.
   *
   * أولوية: الخريطة الصريحة → fallback EXP-005 (مصروفات عامة) → أي حساب expense.
   */
  async getDefaultExpenseAccount(
    tx:        TxClient,
    companyId: string,
    kind?:     string,
  ): Promise<string> {
    const targetCode = kind
      ? (FinancialCoreSupportService.KIND_TO_ACCOUNT_CODE[kind] ?? 'EXP-005')
      : 'EXP-005';

    // محاولة 1: الحساب المُحدَّد بالكود الصريح (يعمل مع expense وasset على حد سواء)
    const specific = await tx.account.findFirst({
      where:  { companyId, code: targetCode, isActive: true },
      select: { id: true },
    });
    if (specific) return specific.id;

    // السلفة لا يجوز أن تسقط إلى مصروف عند غياب الحساب المخصص.
    const fallbackType = kind === 'advance' ? 'asset' : 'expense';
    const fallback = await tx.account.findFirst({
      where:   { companyId, type: fallbackType, isActive: true },
      select:  { id: true },
      orderBy: { code: 'asc' },
    });
    if (!fallback) {
      throw new BadRequestException(
        `لم يُعثر على حساب (${targetCode}) للشركة ${companyId}. ` +
        `تأكد من تشغيل الـ Seed أو إنشاء الحسابات يدوياً في دليل الحسابات.`,
      );
    }
    return fallback.id;
  }

  async getDefaultRevenueAccount(tx: TxClient, companyId: string): Promise<string> {
    const account = await tx.account.findFirst({
      where:   { companyId, type: 'revenue', isActive: true },
      select:  { id: true },
      orderBy: { code: 'asc' },
    });
    if (!account) {
      throw new BadRequestException(
        `لم يُعثر على حساب إيرادات للشركة ${companyId}. يرجى إنشاء حساب من نوع "revenue" في دليل الحسابات.`,
      );
    }
    return account.id;
  }

  /** حساب ضريبة القيمة المضافة المحصلة (TAX-001) */
  async getVatCollectedAccount(tx: TxClient, companyId: string): Promise<string> {
    const account = await tx.account.findFirst({
      where:   { companyId, code: 'TAX-001', type: 'liability', isActive: true },
      select:  { id: true },
    });
    if (!account) {
      throw new BadRequestException(
        `لم يُعثر على حساب ضريبة القيمة المضافة (TAX-001) للشركة ${companyId}.`,
      );
    }
    return account.id;
  }

  // ══════════════════════════════════════════════════════════
  // PRIVATE: Validation & Helpers
  // ══════════════════════════════════════════════════════════

  /**
   * يُحل userId: الأولوية للـ callerUserId، ثم TenantContext.
   * يرفض العملية إذا كان المستخدم مجهول الهوية.
   */
  resolveUserId(callerUserId?: string): string {
    const userId = callerUserId ?? TenantContext.getUserId();
    if (!userId) {
      throw new UnauthorizedException(
        'FINANCIAL_OP_REQUIRES_USER_ID: لا يمكن تنفيذ عملية مالية بدون هوية مستخدم معروفة.',
      );
    }
    return userId;
  }

  /**
   * يُحل tenantId من TenantContext — مطلوب للـ RLS.
   * يرفض العملية إذا لم يكن هناك tenant context.
   */
  resolveTenantId(): string {
    try {
      return TenantContext.getTenantId();
    } catch {
      throw new UnauthorizedException(
        'FINANCIAL_OP_REQUIRES_TENANT_ID: لا يمكن تنفيذ عملية مالية خارج سياق المستأجر.',
      );
    }
  }

  buildDates(transactionDateStr: string) {
    return {
      entryDate: nowSaudi(),
      txDate:    new Date(transactionDateStr),
    };
  }

  /** لقطة فاتورة قابلة للـ JSON للحفظ في AuditLog */
  invoiceSnapshot(inv: Record<string, unknown>): Record<string, unknown> {
    return {
      id:              inv['id'],
      companyId:       inv['companyId'],
      supplierId:      inv['supplierId'],
      invoiceNumber:   inv['invoiceNumber'],
      kind:            inv['kind'],
      totalAmount:     String(inv['totalAmount']),
      netAmount:       String(inv['netAmount']),
      taxAmount:       String(inv['taxAmount']),
      transactionDate: inv['transactionDate'] instanceof Date
        ? (inv['transactionDate'] as Date).toISOString()
        : inv['transactionDate'],
      vaultId:         inv['vaultId'],
      batchId:         inv['batchId'],
      status:          inv['status'],
      entryDate:       inv['entryDate'] instanceof Date
        ? (inv['entryDate'] as Date).toISOString()
        : inv['entryDate'],
      expenseCoverageYear:       inv['expenseCoverageYear'],
      expenseCoverageQuarter:    inv['expenseCoverageQuarter'],
      expenseCoverageMonthStart: inv['expenseCoverageMonthStart'],
      expenseMonthsCovered:      inv['expenseMonthsCovered'],
    };
  }
}
