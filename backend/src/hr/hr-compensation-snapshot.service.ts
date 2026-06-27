import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { getHrAdvanceTotals } from './hr-advance-balance.util';
import { computeHrPayrollLineNet } from './hr-payroll-line-net.util';
import {
  computeHrEmployeeSalaryPackage,
  sumHrCustomAllowanceAmounts,
} from './utils/employee-salary-package.util';

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function decimalMoney(value: Prisma.Decimal | number | string | null | undefined): number {
  return money(value);
}

@Injectable()
export class HrCompensationSnapshotService {
  constructor(private readonly prisma: TenantPrismaService) {}

  private buildSalarySnapshot(employee: {
    id: string;
    companyId: string;
    basicSalary: unknown;
    housingAllowance: unknown;
    transportAllowance: unknown;
    otherAllowance: unknown;
    workHours: string | null;
    workSchedule: string | null;
    customAllowances?: Array<{
      id: string;
      employeeId: string;
      nameAr: string;
      amount: Prisma.Decimal | number | string | null;
    }>;
  }) {
    const customAllowanceTotal = sumHrCustomAllowanceAmounts(employee.customAllowances);
    const salaryPackage = computeHrEmployeeSalaryPackage(employee, customAllowanceTotal);

    return {
      source: 'database' as const,
      companyId: employee.companyId,
      employeeId: employee.id,
      calculatedAt: new Date().toISOString(),
      salaryPackage: {
        basicSalary: decimalMoney(salaryPackage.basicSalary.toString()),
        housingAllowance: decimalMoney(salaryPackage.housingAllowance.toString()),
        transportAllowance: decimalMoney(salaryPackage.transportAllowance.toString()),
        otherAllowance: decimalMoney(salaryPackage.otherAllowance.toString()),
        customAllowanceTotal: decimalMoney(salaryPackage.customAllowanceTotal.toString()),
        overtimeHoursPerDay: salaryPackage.overtimeHoursPerDay,
        overtimePay: decimalMoney(salaryPackage.overtimePay.toString()),
        fixedTotal: decimalMoney(salaryPackage.fixedTotal.toString()),
        total: decimalMoney(salaryPackage.total.toString()),
      },
      customAllowances: {
        total: customAllowanceTotal,
        items: (employee.customAllowances ?? []).map((row) => ({
          id: row.id,
          employeeId: row.employeeId,
          nameAr: row.nameAr,
          amount: decimalMoney(row.amount),
        })),
      },
    };
  }

  async getCompanySnapshots(companyId: string, employeeIds?: string[]) {
    const idFilter = (employeeIds ?? []).map((id) => String(id).trim()).filter(Boolean);
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        ...(idFilter.length ? { id: { in: idFilter } } : {}),
      },
      include: { customAllowances: { orderBy: { createdAt: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    return {
      source: 'database' as const,
      companyId,
      calculatedAt: new Date().toISOString(),
      items: employees.map((employee) => this.buildSalarySnapshot(employee)),
    };
  }

  async getEmployeeSnapshot(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      include: { customAllowances: { orderBy: { createdAt: 'asc' } } },
    });
    if (!employee) throw new NotFoundException('Employee not found.');

    const [advances, payrollItems] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          companyId,
          employeeId,
          kind: 'advance',
          status: { not: 'cancelled' },
        },
        orderBy: { transactionDate: 'desc' },
      }),
      this.prisma.payrollRunItem.findMany({
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
        take: 50,
      }),
    ]);

    const salarySnapshot = this.buildSalarySnapshot(employee);
    const runIds = [...new Set(payrollItems.map((row) => row.payrollRun.id))];
    const salaryInvoices = runIds.length
      ? await this.prisma.invoice.findMany({
          where: {
            companyId,
            kind: 'salary',
            batchId: { in: runIds },
            status: 'active',
          },
          select: { batchId: true, invoiceNumber: true },
          orderBy: { createdAt: 'asc' },
        })
      : [];
    const invoiceNoByRunId = new Map<string, string>();
    for (const invoice of salaryInvoices) {
      if (invoice.batchId && !invoiceNoByRunId.has(invoice.batchId)) {
        invoiceNoByRunId.set(invoice.batchId, invoice.invoiceNumber);
      }
    }

    const mapPayrollItem = (row: (typeof payrollItems)[number]) => {
      const computedNetSalary = computeHrPayrollLineNet({
        grossSalary: row.grossSalary,
        allowancesAdd: row.allowancesAdd,
        deductions: row.deductions,
        advancesDeduct: row.advancesDeduct,
      });
      const netSalary = decimalMoney(row.netSalary);
      return {
        id: row.id,
        payrollRun: {
          ...row.payrollRun,
          issuedSalaryInvoiceNumber: invoiceNoByRunId.get(row.payrollRun.id) ?? null,
        },
        grossSalary: decimalMoney(row.grossSalary),
        allowancesAdd: decimalMoney(row.allowancesAdd),
        deductions: decimalMoney(row.deductions),
        advancesDeduct: decimalMoney(row.advancesDeduct),
        netSalary,
        computedNetSalary,
        netMatchesCentralFormula: Math.abs(computedNetSalary - netSalary) < 0.01,
        notes: row.notes,
      };
    };

    const payrollItemsSnapshot = payrollItems.map(mapPayrollItem);

    return {
      ...salarySnapshot,
      advances: {
        totals: getHrAdvanceTotals(advances),
        items: advances.map((row) => ({
          id: row.id,
          invoiceNumber: row.invoiceNumber,
          transactionDate: row.transactionDate,
          totalAmount: decimalMoney(row.totalAmount),
          settledAmount: decimalMoney(row.settledAmount),
          remainingAmount: Math.max(0, decimalMoney(row.totalAmount) - decimalMoney(row.settledAmount)),
          installmentCount: row.installmentCount,
          installmentAmount: decimalMoney(row.installmentAmount),
          notes: row.notes,
          status: row.status,
        })),
      },
      payrollItems: payrollItemsSnapshot,
      latestPayrollItem: payrollItemsSnapshot[0] ?? null,
    };
  }
}
