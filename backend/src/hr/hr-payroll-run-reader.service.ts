/**
 * HrPayrollRunReaderService — جلب المسيرات + توليد رقم مسير
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { nowSaudi } from '../common/utils/date-utils';
import { individualSalaryBatchId } from './hr-payroll-individual-payment.service';

@Injectable()
export class HrPayrollRunReaderService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async generateRunNumber(companyId: string): Promise<string> {
    const now = nowSaudi();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PR-${yy}${mm}`;
    const count = await this.prisma.payrollRun.count({
      where: { companyId, runNumber: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  async findPayrollRuns(companyId: string, year?: number) {
    const where: Prisma.PayrollRunWhereInput = { companyId };
    if (year) {
      where.payrollMonth = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      };
    }
    const runs = await this.prisma.payrollRun.findMany({
      where,
      include: { items: { include: { employee: true } } },
      orderBy: { payrollMonth: 'desc' },
    });
    if (!runs.length) return runs;
    const runIds = runs.map((r) => r.id);
    const salaryInvoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        kind: 'salary',
        batchId: { in: runIds },
        status: 'active',
      },
      select: { batchId: true, invoiceNumber: true },
      orderBy: { createdAt: 'asc' },
    });
    const invoiceNoByRunId = new Map<string, string>();
    for (const inv of salaryInvoices) {
      if (inv.batchId && !invoiceNoByRunId.has(inv.batchId)) {
        invoiceNoByRunId.set(inv.batchId, inv.invoiceNumber);
      }
    }
    const directPayments = await this.prisma.invoice.findMany({
      where: {
        companyId,
        kind: 'salary',
        status: 'active',
        OR: runs.flatMap((run) => run.items.map((item) => ({ batchId: individualSalaryBatchId(item.employeeId, run.payrollMonth) }))),
      },
      select: { batchId: true, totalAmount: true },
    });
    const directPaidByBatch = new Map<string, Prisma.Decimal>();
    for (const payment of directPayments) {
      if (!payment.batchId) continue;
      directPaidByBatch.set(payment.batchId, (directPaidByBatch.get(payment.batchId) ?? new Prisma.Decimal(0)).plus(payment.totalAmount));
    }
    return runs.map((r) => ({
      ...r,
      issuedSalaryInvoiceNumber: invoiceNoByRunId.get(r.id) ?? null,
      payableAmount: Prisma.Decimal.max(
        new Prisma.Decimal(0),
        new Prisma.Decimal(r.totalAmount).minus(r.items.reduce(
          (sum, item) => sum.plus(directPaidByBatch.get(individualSalaryBatchId(item.employeeId, r.payrollMonth)) ?? 0),
          new Prisma.Decimal(0),
        )),
      ),
    }));
  }

  async findPayrollRunItemsByEmployee(companyId: string, employeeId: string) {
    const items = await this.prisma.payrollRunItem.findMany({
      where: { employeeId, payrollRun: { companyId } },
      include: {
        payrollRun: {
          select: {
            id: true,
            runNumber: true,
            payrollMonth: true,
            status: true,
          },
        },
      },
      orderBy: { payrollRun: { payrollMonth: 'desc' } },
    });
    if (!items.length) return items;
    const runIds = [...new Set(items.map((i) => i.payrollRun.id))];
    const salaryInvoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        kind: 'salary',
        batchId: { in: runIds },
        status: 'active',
      },
      select: { batchId: true, invoiceNumber: true },
      orderBy: { createdAt: 'asc' },
    });
    const invoiceNoByRunId = new Map<string, string>();
    for (const inv of salaryInvoices) {
      if (inv.batchId && !invoiceNoByRunId.has(inv.batchId)) {
        invoiceNoByRunId.set(inv.batchId, inv.invoiceNumber);
      }
    }
    return items.map((row) => ({
      ...row,
      payrollRun: {
        ...row.payrollRun,
        issuedSalaryInvoiceNumber: invoiceNoByRunId.get(row.payrollRun.id) ?? null,
      },
    }));
  }

  async findPayrollRunById(id: string, companyId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
      include: {
        runVaultSplits: { include: { vault: true } },
        items: {
          include: {
            employee: true,
            vaultSplits: { include: { vault: true } },
          },
        },
      },
    });
    if (!run) throw new NotFoundException(`مسيرة الرواتب ${id} غير موجودة.`);

    const salaryInvoice = await this.prisma.invoice.findFirst({
      where: {
        companyId,
        batchId: id,
        kind: 'salary',
        status: 'active',
      },
      select: { invoiceNumber: true },
      orderBy: { createdAt: 'desc' },
    });

    const directPayments = await this.prisma.invoice.aggregate({
      where: {
        companyId,
        kind: 'salary',
        status: 'active',
        OR: run.items.map((item) => ({ batchId: individualSalaryBatchId(item.employeeId, run.payrollMonth) })),
      },
      _sum: { totalAmount: true },
    });
    return {
      ...run,
      issuedSalaryInvoiceNumber: salaryInvoice?.invoiceNumber ?? null,
      payableAmount: Prisma.Decimal.max(
        new Prisma.Decimal(0),
        new Prisma.Decimal(run.totalAmount).minus(directPayments._sum.totalAmount ?? 0),
      ),
    };
  }
}
