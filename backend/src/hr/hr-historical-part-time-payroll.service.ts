import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreateHistoricalPartTimePayrollLinkDto } from './dto/historical-part-time-payroll.dto';

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const monthStart = (month: string) => new Date(`${month}-01T00:00:00.000Z`);
const normalize = (value: string) => value
  .toLocaleLowerCase('ar')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/\s+/g, ' ')
  .trim();

@Injectable()
export class HrHistoricalPartTimePayrollService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async create(companyId: string, userId: string, dto: CreateHistoricalPartTimePayrollLinkDto) {
    return this.prisma.withTenant(async (tx) => {
      const transaction = tx as unknown as Prisma.TransactionClient;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`historical-part-time:${companyId}:${dto.targetMonth}`}))`;
      const existing = await transaction.historicalPartTimePayrollLink.findUnique({ where: { ledgerEntryId: dto.ledgerEntryId } });
      if (existing?.status === 'active') throw new ConflictException('هذا القيد مرتبط بالفعل كراتب دوام جزئي تاريخي.');

      const ledger = await transaction.ledgerEntry.findFirst({
        where: {
          id: dto.ledgerEntryId,
          companyId,
          status: 'active',
          debitAccount: { code: 'EXP-004' },
          NOT: { referenceType: 'advance_settlement' },
        },
        include: { employee: { select: { id: true, name: true } } },
      });
      if (!ledger) throw new NotFoundException('قيد راتب مؤهل غير موجود في هذه الشركة.');
      if (monthKey(ledger.transactionDate) !== dto.targetMonth) {
        throw new BadRequestException('شهر الربط يجب أن يطابق تاريخ القيد المحاسبي نفسه.');
      }

      // A normal payroll accrual is already explained by its payroll run, and an
      // advance settlement must never become salary. Both are deliberately blocked.
      if (ledger.referenceType === 'payroll_accrual') {
        throw new BadRequestException('قيد استحقاق المسير منظم بالفعل ولا يحتاج ربط دوام جزئي.');
      }

      const sourceInvoice = ['invoice', 'salary'].includes(ledger.referenceType)
        ? await transaction.invoice.findFirst({
            where: { id: ledger.referenceId, companyId },
            select: { notes: true, employeeId: true, batchId: true, kind: true },
          })
        : null;
      if (sourceInvoice?.kind === 'advance') {
        throw new BadRequestException('هذا القيد مرتبط بسلفة؛ لا يمكن تصنيفه كدوام جزئي.');
      }
      // Legacy part-time invoices were sometimes grouped with a payroll batch
      // while retaining kind=expense. A batch label alone is not evidence of a
      // standard salary payment: only a true salary invoice is already covered
      // by the payroll run and must remain blocked here.
      if (sourceInvoice?.batchId && sourceInvoice.kind === 'salary') {
        throw new BadRequestException('هذا القيد راتب صادر من مسير؛ لا يمكن تصنيفه كدوام جزئي.');
      }

      let employeeId = ledger.employeeId ?? sourceInvoice?.employeeId ?? null;
      let employeeName = ledger.employee?.name ?? null;
      let employeeMatchSource: 'ledger' | 'description' | 'none' = employeeId ? 'ledger' : 'none';
      const descriptionSnapshot = sourceInvoice?.notes?.trim() || null;
      if (!employeeId && descriptionSnapshot) {
        const description = normalize(descriptionSnapshot);
        const employees = await transaction.employee.findMany({
          where: { companyId },
          select: { id: true, name: true },
        });
        const matches = employees.filter((employee) => {
          const name = normalize(employee.name);
          return name.length >= 3 && description.includes(name);
        });
        if (matches.length === 1) {
          employeeId = matches[0].id;
          employeeName = matches[0].name;
          employeeMatchSource = 'description';
        }
      }

      const company = await transaction.company.findUnique({ where: { id: companyId }, select: { tenantId: true } });
      if (!company) throw new NotFoundException('الشركة غير موجودة.');
      const link = await transaction.historicalPartTimePayrollLink.upsert({
        where: { ledgerEntryId: ledger.id },
        create: {
          tenantId: company.tenantId,
          companyId,
          ledgerEntryId: ledger.id,
          employeeId,
          payrollMonth: monthStart(dto.targetMonth),
          employeeMatchSource,
          descriptionSnapshot,
          createdById: userId,
        },
        update: {
          employeeId,
          payrollMonth: monthStart(dto.targetMonth),
          employeeMatchSource,
          descriptionSnapshot,
          status: 'active',
          reversedAt: null,
          reversedById: null,
          createdById: userId,
        },
      });
      await transaction.auditLog.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          userId,
          action: 'classify',
          entity: 'historical_part_time_payroll_link',
          entityId: link.id,
          newValue: {
            ledgerEntryId: ledger.id,
            targetMonth: dto.targetMonth,
            amount: ledger.amount.toString(),
            employeeId,
            employeeName: employeeName ?? 'بدون اسم موظف',
            employeeMatchSource,
            accountingImpact: { ledger: 0, invoices: 0, vaults: 0, advances: 0 },
          },
        },
      });
      return {
        success: true,
        linkId: link.id,
        ledgerEntryId: ledger.id,
        targetMonth: dto.targetMonth,
        employeeName: employeeName ?? 'بدون اسم موظف',
        employeeMatchSource,
        amount: Number(ledger.amount),
        accountingImpact: { ledger: 0, invoices: 0, vaults: 0, advances: 0 },
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
