/**
 * InvoiceService — طبقة رفيعة (Thin Layer) فوق FinancialCoreService
 *
 * لا يحتوي على منطق مالي مباشر — يُفوَّض بالكامل للمحرك المركزي.
 * المسؤوليات المتبقية هنا:
 *   - findAll, findOne (قراءة فقط)
 *   - update (لا يزال هنا لأنه يحتاج AuditLog بالقيمة القديمة)
 *   - createWithLedger يُفوَّض → FinancialCoreService.processOutflow
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma }               from '@prisma/client';
import Decimal                  from 'decimal.js';
import { TenantPrismaService }   from '../prisma/tenant-prisma.service';
import { splitTax }             from '../common/utils/math-engine';
import { TenantContext }        from '../common/tenant-context';
import { AuditLogService }      from '../audit/audit-log.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { VaultsService }        from '../vaults/vaults.service';
import { nowSaudi }             from '../common/utils/date-utils';
import { CreateInvoiceDto }      from './dto/create-invoice.dto';
import { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';
import { UpdateInvoiceDto }      from './dto/update-invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma:         TenantPrismaService,
    private readonly audit:          AuditLogService,
    private readonly financialCore:  FinancialCoreService,
    private readonly vaultsService:  VaultsService,
  ) {}

  /**
   * إنشاء فاتورة — يُفوَّض بالكامل للمحرك المالي المركزي.
   * حساب الضريبة: إن لم يُمرَّر netAmount/taxAmount، يُحسبان من totalAmount و isTaxable (15%).
   */
  async createWithLedger(dto: CreateInvoiceDto, userId?: string | null) {
    const needsSupplierNumber =
      (dto.supplierId || dto.expenseLineId) &&
      ['purchase', 'expense', 'fixed_expense'].includes(dto.kind) &&
      dto.isTaxable !== false;
    if (needsSupplierNumber && !dto.supplierInvoiceNumber?.trim()) {
      throw new BadRequestException('رقم فاتورة المورد مطلوب عند وجود مورد وفاتورة خاضعة للضريبة');
    }

    const total   = new Decimal(String(dto.totalAmount));
    const taxable = dto.isTaxable !== false;
    let net: string;
    let tax: string;
    if (dto.netAmount != null && dto.taxAmount != null) {
      net = String(dto.netAmount);
      tax = String(dto.taxAmount);
    } else {
      const rate = taxable ? 0.15 : 0;
      const { net: netDec, tax: taxDec } = splitTax(total, rate);
      net = netDec.toFixed(4);
      tax = taxDec.toFixed(4);
    }
    return this.financialCore.processOutflow(
      {
        companyId:       dto.companyId,
        supplierId:      dto.supplierId ?? undefined,
        employeeId:      dto.employeeId ?? undefined,
        expenseLineId:   dto.expenseLineId ?? undefined,
        categoryId:      dto.categoryId ?? undefined,
        supplierInvoiceNumber: dto.supplierInvoiceNumber ?? undefined,
        kind:                  dto.kind as 'purchase' | 'expense' | 'hr_expense' | 'fixed_expense' | 'salary' | 'advance',
        totalAmount:     String(dto.totalAmount),
        netAmount:       net,
        taxAmount:       tax,
        transactionDate: typeof dto.transactionDate === 'string'
          ? dto.transactionDate
          : new Date(dto.transactionDate).toISOString().slice(0, 10),
        invoiceDate:     dto.invoiceDate ? String(dto.invoiceDate) : undefined,
        vaultId:         dto.vaultId ?? undefined,
        batchId:         dto.batchId  ?? undefined,
        debitAccountId:  dto.debitAccountId ?? undefined,
        notes:           dto.notes ?? undefined,
      },
      userId ?? undefined,
    );
  }

  /**
   * إنشاء دفعة فواتير في transaction واحدة — Rollback الكل عند فشل أي فاتورة.
   */
  async createBatchWithLedger(dto: CreateInvoiceBatchDto, userId?: string | null) {
    try {
      const batchId = `B-${Date.now()}`;
      const validItems = dto.items.filter((i) => {
        if (Number(i.totalAmount) <= 0) return false;
        const hasSupplierRef = !!(i.supplierId || i.expenseLineId);
        const hasSupplierNumber = !!(i.supplierInvoiceNumber?.trim() || i.invoiceNumber?.trim());
        const isTaxable = i.isTaxable !== false;
        if (hasSupplierRef && isTaxable && !hasSupplierNumber) return false;
        if (i.supplierId) return true;
        if (i.expenseLineId) return true;
        if ((i.kind === 'fixed_expense' || i.kind === 'expense') && i.notes?.trim()) return true;
        return false;
      });
      if (validItems.length === 0) {
        throw new BadRequestException('لا توجد صفوف صالحة للحفظ.');
      }
      const txDate = typeof dto.transactionDate === 'string'
        ? dto.transactionDate
        : new Date(dto.transactionDate).toISOString().slice(0, 10);

      const dtos = [];
      for (const item of validItems) {
        let supplierId = item.supplierId || undefined;
        let categoryId = item.categoryId || undefined;
        let kind = item.kind as 'purchase' | 'expense' | 'hr_expense' | 'fixed_expense';
        let debitAccountId = (item.debitAccountId && item.debitAccountId.trim()) ? item.debitAccountId : undefined;

        if (item.expenseLineId) {
          const line = await this.prisma.expenseLine.findFirst({
            where: { id: item.expenseLineId, companyId: dto.companyId },
            include: { category: { select: { accountId: true } } },
          });
          if (line) {
            supplierId = line.supplierId;
            categoryId = line.categoryId;
            kind = line.kind as 'fixed_expense' | 'expense';
            debitAccountId = debitAccountId || line.category?.accountId || undefined;
          }
        }

        const total = new Decimal(String(item.totalAmount));
        const taxable = item.isTaxable !== false;
        const rate = taxable ? 0.15 : 0;
        const { net, tax } = splitTax(total, rate);
        dtos.push({
          companyId:             dto.companyId,
          supplierId,
          expenseLineId:         item.expenseLineId || undefined,
          categoryId,
          supplierInvoiceNumber: item.supplierInvoiceNumber ?? item.invoiceNumber ?? undefined,
          kind,
          totalAmount:     total.toFixed(4),
          netAmount:       net.toFixed(4),
          taxAmount:       tax.toFixed(4),
          transactionDate: txDate,
          invoiceDate:     item.invoiceDate,
          batchId,
          vaultId:         dto.vaultId ?? undefined,
          debitAccountId,
          notes:           item.notes?.trim() || undefined,
        });
      }
      const results = await this.financialCore.processOutflowBatch(
        dtos,
        userId ?? undefined,
        dto.idempotencyKey,
      );
      return {
        batchId,
        count:   results.length,
        invoices: results.map((r) => r.invoice),
      };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      throw new BadRequestException(
        err instanceof Error ? err.message : 'فشل حفظ الدفعة. تأكد من وجود خزنة وحسابات مصروفات للشركة.',
      );
    }
  }

  /**
   * تعديل فاتورة مع تسجيل القيمة القديمة والجديدة في AuditLog.
   * عند status: 'cancelled' → يُستدعى cancelOperation لإلغاء الفاتورة والقيود معاً
   *    (لا تُحتسب الفاتورة الملغاة في الميزانية ولا التقارير).
   */
  async update(id: string, dto: UpdateInvoiceDto, companyId: string, userId?: string | null) {
    if (dto.status === 'cancelled') {
      const inv = await this.prisma.invoice.findFirstOrThrow({ where: { id, companyId } });
      // فواتير المبيعات: إلغاء الملخص المرتبط (referenceId = dailySalesSummaryId)
      const refType = inv.kind === 'sale'
        ? 'sale'
        : inv.kind === 'salary'
          ? 'salary'
          : inv.kind === 'advance'
            ? 'advance'
            : 'invoice';
      const referenceId = inv.kind === 'sale' && inv.dailySalesSummaryId
        ? inv.dailySalesSummaryId
        : id;
      await this.financialCore.cancelOperation(
        { companyId, referenceType: refType, referenceId, reason: 'إلغاء من واجهة الفواتير' },
        userId ?? undefined,
      );
      return this.prisma.invoice.findFirstOrThrow({ where: { id, companyId } });
    }

    const tenantId = TenantContext.getTenantId();

    return this.prisma.$transaction(async (tx) => {
      const oldInvoice = await tx.invoice.findFirstOrThrow({ where: { id, companyId } });

      const updateData: Prisma.InvoiceUncheckedUpdateInput = {};
      if (dto.supplierId            !== undefined) updateData.supplierId            = dto.supplierId;
      if (dto.supplierInvoiceNumber !== undefined) updateData.supplierInvoiceNumber = dto.supplierInvoiceNumber;
      if (dto.kind            !== undefined) updateData.kind            = dto.kind;
      if (dto.totalAmount     !== undefined) updateData.totalAmount     = new Prisma.Decimal(dto.totalAmount);
      if (dto.netAmount       !== undefined) updateData.netAmount       = new Prisma.Decimal(dto.netAmount);
      if (dto.taxAmount       !== undefined) updateData.taxAmount       = new Prisma.Decimal(dto.taxAmount);
      if (dto.transactionDate !== undefined) updateData.transactionDate = new Date(dto.transactionDate);
      if (dto.settledAt       !== undefined) updateData.settledAt       = dto.settledAt ? new Date(dto.settledAt) : null;
      if (dto.settledAmount   !== undefined) updateData.settledAmount   = new Prisma.Decimal(dto.settledAmount);
      if (dto.vaultId         !== undefined) updateData.vaultId         = dto.vaultId;
      if (dto.paymentMethodId !== undefined) updateData.paymentMethodId = dto.paymentMethodId;
      if (dto.status          !== undefined) updateData.status          = dto.status;
      if (dto.notes           !== undefined) updateData.notes           = dto.notes;

      const newInvoice = await tx.invoice.update({ where: { id }, data: updateData });

      await tx.auditLog.create({
        data: {
          tenantId,
          companyId,
          userId:    userId ?? undefined,
          action:    'update',
          entity:    'invoice',
          entityId:  id,
          oldValue:  AuditLogService.invoiceToSnapshot(oldInvoice as Parameters<typeof AuditLogService.invoiceToSnapshot>[0]) as object,
          newValue:  AuditLogService.invoiceToSnapshot(newInvoice as Parameters<typeof AuditLogService.invoiceToSnapshot>[0]) as object,
          createdAt: nowSaudi(),
        },
      });

      return newInvoice;
    });
  }

  async findOne(id: string, companyId: string) {
    return this.prisma.invoice.findFirstOrThrow({
      where:   { id, companyId },
      include: { supplier: true, vault: true },
    });
  }

  async findAll(
    companyId: string,
    page       = 1,
    pageSize   = 50,
    startDate?: string,
    endDate?:   string,
    batchId?:   string,
    employeeId?: string,
    kind?:      string,
    supplierId?: string,
    categoryId?: string,
    expenseLineId?: string,
    sortBy = 'transactionDate',
    sortDir: 'asc' | 'desc' | string = 'desc',
    q?: string,
  ) {
    // معالجة التواريخ: YYYY-MM-DD → بداية اليوم ونهاية اليوم (UTC) — مطابق لـ SalesService
    const dateFilter =
      startDate || endDate
        ? {
            transactionDate: {
              ...(startDate
                ? { gte: new Date(`${String(startDate).slice(0, 10)}T00:00:00.000Z`) }
                : {}),
              ...(endDate
                ? { lte: new Date(`${String(endDate).slice(0, 10)}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {};
    const batchFilter = batchId ? { batchId } : {};
    const employeeFilter = employeeId ? { employeeId } : {};
    const kindFilter = kind ? { kind: { in: kind.split(',').map((k) => k.trim()) } } : {};
    const supplierFilter = supplierId ? { supplierId } : {};
    const categoryFilter = categoryId ? { categoryId } : {};
    const expenseLineFilter = expenseLineId ? { expenseLineId } : {};

    const needle = (q || '').trim().slice(0, 120);
    const searchFilter: Prisma.InvoiceWhereInput =
      needle.length > 0
        ? {
            OR: [
              { invoiceNumber: { contains: needle, mode: 'insensitive' } },
              { supplierInvoiceNumber: { contains: needle, mode: 'insensitive' } },
              { notes: { contains: needle, mode: 'insensitive' } },
              {
                supplier: {
                  is: {
                    OR: [
                      { nameAr: { contains: needle, mode: 'insensitive' } },
                      { nameEn: { contains: needle, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              {
                employee: {
                  is: {
                    OR: [
                      { name: { contains: needle, mode: 'insensitive' } },
                      { nameEn: { contains: needle, mode: 'insensitive' } },
                      { employeeSerial: { contains: needle, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              {
                expenseLine: {
                  is: {
                    OR: [
                      { nameAr: { contains: needle, mode: 'insensitive' } },
                      { nameEn: { contains: needle, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {};

    const where = {
      companyId,
      ...dateFilter,
      ...batchFilter,
      ...employeeFilter,
      ...kindFilter,
      ...supplierFilter,
      ...categoryFilter,
      ...expenseLineFilter,
      ...searchFilter,
    };

    const dir: Prisma.SortOrder = String(sortDir).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const allowedSort = new Set(['transactionDate', 'createdAt', 'invoiceNumber', 'totalAmount', 'netAmount', 'taxAmount']);
    const primarySortField = allowedSort.has(sortBy) ? sortBy : 'transactionDate';
    const orderBy: Prisma.InvoiceOrderByWithRelationInput[] = [];
    orderBy.push({ [primarySortField]: dir });
    if (primarySortField !== 'transactionDate') {
      orderBy.push({ transactionDate: dir });
    }
    // ضمان ثبات الترتيب: عند تساوي transactionDate يظهر آخر مُدخل أولاً افتراضياً
    orderBy.push({ createdAt: dir });

    const size = Math.min(200, Math.max(1, pageSize));
    const p = Math.max(1, page);

    const activeWhere = { ...where, status: 'active' };

    const [items, total, byKind] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy,
        skip:    (p - 1) * size,
        take:    size,
        include: {
          supplier: true,
          employee: { select: { id: true, name: true } },
          expenseLine: { select: { id: true, nameAr: true, kind: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.groupBy({
        by: ['kind'],
        where: activeWhere,
        _sum: { netAmount: true, taxAmount: true, totalAmount: true },
        _count: { _all: true },
      }),
    ]);

    const zero = () => ({ net: '0', tax: '0', total: '0', count: 0 });
    const sums = { all: zero(), inflow: zero(), outflow: zero() };
    for (const row of byKind) {
      const n = row._sum.netAmount?.toString()   ?? '0';
      const x = row._sum.taxAmount?.toString()   ?? '0';
      const t = row._sum.totalAmount?.toString() ?? '0';
      const c = row._count._all;
      const target = row.kind === 'sale' ? sums.inflow : sums.outflow;
      target.net   = new Decimal(target.net).plus(n).toString();
      target.tax   = new Decimal(target.tax).plus(x).toString();
      target.total = new Decimal(target.total).plus(t).toString();
      target.count += c;
      sums.all.net   = new Decimal(sums.all.net).plus(n).toString();
      sums.all.tax   = new Decimal(sums.all.tax).plus(x).toString();
      sums.all.total = new Decimal(sums.all.total).plus(t).toString();
      sums.all.count += c;
    }

    return { items, total, page: p, pageSize: size, sums };
  }

  private buildDateFilter(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return {};
    return {
      transactionDate: {
        ...(startDate
          ? { gte: new Date(`${String(startDate).slice(0, 10)}T00:00:00.000Z`) }
          : {}),
        ...(endDate
          ? { lte: new Date(`${String(endDate).slice(0, 10)}T23:59:59.999Z`) }
          : {}),
      },
    };
  }

  private static readonly DAY_CLOSE_OUTFLOW_KINDS = [
    'purchase',
    'expense',
    'fixed_expense',
    'hr_expense',
    'salary',
    'advance',
  ] as const;

  /**
   * تقرير نهاية اليوم — ملخص مالي مضغوط ليوم واحد: فواتير، مبيعات يومية، خزائن، تحويلات، تفصيل مصروفات.
   */
  async getDayCloseReport(companyId: string, dateStr: string) {
    if (!companyId?.trim()) throw new BadRequestException('companyId مطلوب');
    const d = String(dateStr || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      throw new BadRequestException('date مطلوب بصيغة YYYY-MM-DD');
    }

    const dateFilter     = this.buildDateFilter(d, d);
    const activeDayWhere = { companyId, status: 'active' as const, ...dateFilter };
    const MAX            = 2000;

    const [
      byKindRows,
      invoiceCountAll,
      invoices,
      salesSummaries,
      vaultsAsOf,
      vaultsDay,
      transferAgg,
      byCategoryRows,
    ] = await Promise.all([
      this.prisma.invoice.groupBy({
        by:     ['kind'],
        where:  activeDayWhere,
        _sum:   { netAmount: true, taxAmount: true, totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.count({ where: { companyId, ...dateFilter } }),
      this.prisma.invoice.findMany({
        where:   { companyId, ...dateFilter },
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
        take:    MAX + 1,
        include: {
          supplier:    { select: { nameAr: true, nameEn: true } },
          employee:    { select: { id: true, name: true } },
          expenseLine: { select: { id: true, nameAr: true, kind: true } },
          vault:       { select: { id: true, nameAr: true, type: true, paymentMethod: true } },
        },
      }),
      this.prisma.dailySalesSummary.findMany({
        where:   { companyId, status: 'active', ...dateFilter },
        include: {
          channels: { include: { vault: { select: { nameAr: true, type: true } } } },
        },
        orderBy: { summaryNumber: 'asc' },
      }),
      this.vaultsService.getBalancesAsOf(companyId, d),
      this.vaultsService.findAll(companyId, false, d, d),
      this.prisma.ledgerEntry.aggregate({
        where: { companyId, status: 'active', referenceType: 'transfer', ...dateFilter },
        _sum:  { amount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.groupBy({
        by:    ['categoryId'],
        where: {
          companyId,
          status:     'active',
          ...dateFilter,
          kind:       { in: [...InvoiceService.DAY_CLOSE_OUTFLOW_KINDS] },
          categoryId: { not: null },
        },
        _sum:   { totalAmount: true },
        _count: { _all: true },
      }),
    ]);

    const invoicesTruncated = invoices.length > MAX;
    const invoiceRows       = invoicesTruncated ? invoices.slice(0, MAX) : invoices;

    const zero = () => ({ net: '0', tax: '0', total: '0', count: 0 });
    const sums = { all: zero(), inflow: zero(), outflow: zero() };
    const byKind: { kind: string; count: number; net: string; tax: string; total: string }[] = [];
    for (const row of byKindRows) {
      const n = row._sum.netAmount?.toString()   ?? '0';
      const x = row._sum.taxAmount?.toString()   ?? '0';
      const t = row._sum.totalAmount?.toString() ?? '0';
      const c = row._count._all;
      byKind.push({ kind: row.kind, count: c, net: n, tax: x, total: t });
      const target = row.kind === 'sale' ? sums.inflow : sums.outflow;
      target.net   = new Decimal(target.net).plus(n).toString();
      target.tax   = new Decimal(target.tax).plus(x).toString();
      target.total = new Decimal(target.total).plus(t).toString();
      target.count += c;
      sums.all.net   = new Decimal(sums.all.net).plus(n).toString();
      sums.all.tax   = new Decimal(sums.all.tax).plus(x).toString();
      sums.all.total = new Decimal(sums.all.total).plus(t).toString();
      sums.all.count += c;
    }
    byKind.sort((a, b) => a.kind.localeCompare(b.kind));

    const catIds = [...new Set(byCategoryRows.map((r) => r.categoryId).filter(Boolean))] as string[];
    const categories =
      catIds.length > 0
        ? await this.prisma.category.findMany({
            where:   { id: { in: catIds }, companyId },
            select: { id: true, nameAr: true },
          })
        : [];
    const catName = new Map(categories.map((c) => [c.id, c.nameAr]));

    const expensesByCategory = byCategoryRows
      .filter((r) => r.categoryId)
      .map((r) => ({
        categoryId:   r.categoryId as string,
        nameAr:       catName.get(r.categoryId as string) ?? '—',
        total:        (r._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
        count:        r._count._all,
      }))
      .sort((a, b) => new Decimal(b.total).cmp(a.total));

    const payTotals = new Map<string, Decimal>();
    for (const inv of invoiceRows) {
      if (inv.status !== 'active') continue;
      if (inv.kind === 'sale') continue;
      const label =
        (inv.vault?.paymentMethod && String(inv.vault.paymentMethod).trim()) ||
        (inv.vault?.nameAr && String(inv.vault.nameAr).trim()) ||
        '—';
      const cur = payTotals.get(label) ?? new Decimal(0);
      payTotals.set(label, cur.plus(inv.totalAmount.toString()));
    }
    const outflowByPaymentMethod = [...payTotals.entries()]
      .map(([label, dec]) => ({ label, total: dec.toFixed(4) }))
      .sort((a, b) => new Decimal(b.total).cmp(a.total));

    const vaultsAsOfLite = vaultsAsOf.map((v) => ({
      id:       v.id,
      nameAr:   v.nameAr,
      type:     v.type,
      balance:  v.balance,
      totalIn:  v.totalIn,
      totalOut: v.totalOut,
    }));
    const vaultsDayLite = vaultsDay.map((v) => ({
      id:       v.id,
      nameAr:   v.nameAr,
      type:     v.type,
      totalIn:  v.totalIn,
      totalOut: v.totalOut,
      netDay:   new Decimal(v.totalIn).minus(v.totalOut).toNumber(),
    }));

    const cashVaultsDay   = vaultsDay.filter((v) => v.type === 'cash');
    const cashVaultsAsOf  = vaultsAsOf.filter((v) => v.type === 'cash');
    const cashDayIn       = cashVaultsDay.reduce((s, v) => s.plus(v.totalIn), new Decimal(0)).toNumber();
    const cashDayOut      = cashVaultsDay.reduce((s, v) => s.plus(v.totalOut), new Decimal(0)).toNumber();
    const cashBalanceEod  = cashVaultsAsOf.reduce((s, v) => s.plus(v.balance), new Decimal(0)).toNumber();

    const operations = invoiceRows.map((inv) => ({
      id:              inv.id,
      invoiceNumber:   inv.invoiceNumber,
      kind:            inv.kind,
      status:          inv.status,
      totalAmount:     inv.totalAmount.toString(),
      netAmount:       inv.netAmount.toString(),
      taxAmount:       inv.taxAmount.toString(),
      transactionDate: inv.transactionDate,
      notes:           inv.notes,
      supplierName:    inv.supplier?.nameAr || inv.supplier?.nameEn || null,
      employeeName:    inv.employee?.name || null,
      expenseLineName: inv.expenseLine?.nameAr || null,
      vaultName:       inv.vault?.nameAr || null,
      vaultType:       inv.vault?.type || null,
      paymentChannel:  inv.vault?.paymentMethod?.trim() || inv.vault?.nameAr || null,
    }));

    const salesLite = salesSummaries.map((s) => ({
      id:              s.id,
      summaryNumber:   s.summaryNumber,
      customerCount:   s.customerCount,
      cashOnHand:      s.cashOnHand.toString(),
      totalAmount:     s.totalAmount.toString(),
      notes:           s.notes,
      channels:        s.channels.map((ch) => ({
        vaultName: ch.vault?.nameAr ?? '—',
        vaultType: ch.vault?.type ?? null,
        amount:    ch.amount.toString(),
      })),
    }));

    return {
      date: d,
      meta: {
        invoiceCountAll,
        operationsReturned: invoiceRows.length,
        invoicesTruncated,
      },
      sums,
      byKind,
      salesSummaries: salesLite,
      expensesByCategory,
      outflowByPaymentMethod,
      transfers: {
        count:  transferAgg._count._all,
        volume: (transferAgg._sum.amount ?? new Prisma.Decimal(0)).toString(),
      },
      vaults: {
        balanceEndOfDayByVault: vaultsAsOfLite,
        movementOnDayByVault:   vaultsDayLite,
      },
      cash: {
        dayTotalIn:  cashDayIn,
        dayTotalOut: cashDayOut,
        netDay:      new Decimal(cashDayIn).minus(cashDayOut).toNumber(),
        balanceEndOfDayCashVaults: cashBalanceEod,
      },
      operations,
    };
  }

  /**
   * ملخص دفعات المشتريات/المصروفات في الفترة — استعلام واحد ثم تجميع في الذاكرة.
   * يُستخدم بدل جلب صفحة واحدة (50) من الفواتير فقط.
   */
  async findPurchaseBatchSummaries(companyId: string, startDate?: string, endDate?: string, q?: string) {
    const dateFilter = this.buildDateFilter(startDate, endDate);
    const where: Prisma.InvoiceWhereInput = {
      companyId,
      batchId: { not: null },
      kind:    { in: ['purchase', 'expense', 'fixed_expense'] },
      ...dateFilter,
    };

    const rowCount = await this.prisma.invoice.count({ where });
    const MAX = 60_000;
    if (rowCount > MAX) {
      throw new BadRequestException(
        `عدد فواتير الدفعات في الفترة (${rowCount}) يتجاوز الحد المسموح (${MAX}). اضيّق نطاق التاريخ.`,
      );
    }

    const rows = await this.prisma.invoice.findMany({
      where,
      select: {
        id: true,
        batchId: true,
        status: true,
        transactionDate: true,
        netAmount: true,
        taxAmount: true,
        totalAmount: true,
        notes: true,
        supplier: { select: { nameAr: true, nameEn: true } },
        vault:     { select: { nameAr: true, nameEn: true } },
      },
      orderBy: { transactionDate: 'desc' },
    });

    const byBatch = new Map<string, typeof rows>();
    for (const r of rows) {
      const bid = r.batchId as string;
      if (!byBatch.has(bid)) byBatch.set(bid, []);
      byBatch.get(bid)!.push(r);
    }

    const batches = [];
    for (const [batchId, invs] of byBatch) {
      const activeCount = invs.filter((i) => i.status === 'active').length;
      const cancelledCount = invs.filter((i) => i.status === 'cancelled').length;
      const status =
        cancelledCount === 0 ? 'active' : activeCount === 0 ? 'cancelled' : 'partial';
      const supplierNames = [
        ...new Set(
          invs
            .map((i) => i.supplier?.nameAr || i.supplier?.nameEn || i.notes || '')
            .filter(Boolean),
        ),
      ].join(' | ');
      const netAmount = invs.reduce((s, i) => s.plus(new Decimal(i.netAmount.toString())), new Decimal(0));
      const taxAmount = invs.reduce((s, i) => s.plus(new Decimal(i.taxAmount.toString())), new Decimal(0));
      const totalAmount = invs.reduce((s, i) => s.plus(new Decimal(i.totalAmount.toString())), new Decimal(0));
      const transactionDate = invs[0]?.transactionDate;
      const vaultLabels = [
        ...new Set(
          invs
            .map((i) => i.vault?.nameAr || i.vault?.nameEn || '')
            .filter(Boolean),
        ),
      ];
      const vaultName = vaultLabels.length ? vaultLabels.join(' | ') : '—';
      batches.push({
        batchId,
        transactionDate,
        invoiceCount: invs.length,
        supplierNames: supplierNames || '—',
        vaultName,
        netAmount: netAmount.toFixed(4),
        taxAmount: taxAmount.toFixed(4),
        totalAmount: totalAmount.toFixed(4),
        status,
      });
    }

    const needle = (q || '').trim().toLowerCase();
    const filteredBatches =
      needle.length > 0
        ? batches.filter(
            (b) =>
              String(b.batchId || '')
                .toLowerCase()
                .includes(needle) ||
              String(b.supplierNames || '')
                .toLowerCase()
                .includes(needle) ||
              String(b.vaultName || '')
                .toLowerCase()
                .includes(needle),
          )
        : batches;

    filteredBatches.sort((a, b) => {
      const ta = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
      const tb = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
      return tb - ta;
    });

    return { batches: filteredBatches, rowCount: filteredBatches.length };
  }
}
