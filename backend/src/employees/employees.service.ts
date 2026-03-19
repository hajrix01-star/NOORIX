/**
 * EmployeesService — إدارة الموظفين (CRUD)
 *
 * جميع العمليات تمر عبر TenantContext لضمان RLS.
 * الصرف المالي (راتب/سلفية) يمر عبر FinancialCoreService — لا منطق مالي هنا.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }   from '../common/tenant-context';
import { AuditLogService } from '../audit/audit-log.service';
import { nowSaudi }        from '../common/utils/date-utils';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateBatchEmployeesDto } from './dto/create-batch-employees.dto';

const DEFAULT_PREFIX = 'EMP';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit:  AuditLogService,
  ) {}

  /** توليد الرقم الوظيفي الفريد حسب الشركة (مثل MS-ST-001 أو EMP-ST-001) */
  private async generateEmployeeSerial(companyId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { nameAr: true, nameEn: true },
    });
    const raw = (company?.nameEn || company?.nameAr || '').replace(/\s+/g, '');
    const prefix = raw.length >= 2
      ? raw.slice(0, 2).toUpperCase().replace(/[^A-Z0-9]/g, '')
      : '';
    const safePrefix = prefix.length >= 2 ? prefix : DEFAULT_PREFIX;

    const last = await this.prisma.employee.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { employeeSerial: true },
    });

    let seq = 1;
    if (last?.employeeSerial) {
      const match = last.employeeSerial.match(/-(\d+)$/);
      if (match) seq = parseInt(match[1], 10) + 1;
    }
    return `${safePrefix}-ST-${String(seq).padStart(3, '0')}`;
  }

  async findAll(companyId: string, includeTerminated = false) {
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      ...(includeTerminated ? {} : { status: { notIn: ['terminated', 'archived'] } }),
    };
    return this.prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true, employeeSerial: true, name: true, nameEn: true, jobTitle: true,
        basicSalary: true, housingAllowance: true, transportAllowance: true, otherAllowance: true,
        workHours: true, workSchedule: true,
        iqamaNumber: true, joinDate: true, status: true, notes: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string, companyId: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, companyId },
      include: {
        invoices: {
          where:   { status: 'active' },
          orderBy: { transactionDate: 'desc' },
          take:    10,
          select: { id: true, kind: true, totalAmount: true, transactionDate: true, invoiceNumber: true },
        },
        ledgerEntries: {
          where:   { status: 'active', referenceType: { in: ['salary', 'advance'] } },
          orderBy: { transactionDate: 'desc' },
          take:    10,
          select: { id: true, amount: true, transactionDate: true, referenceType: true },
        },
      },
    });
    if (!emp) throw new NotFoundException(`الموظف ${id} غير موجود.`);
    return emp;
  }

  async create(dto: CreateEmployeeDto, userId?: string) {
    const tenantId = TenantContext.getTenantId();

    if (dto.iqamaNumber) {
      const dup = await this.prisma.employee.findFirst({
        where: { companyId: dto.companyId, iqamaNumber: dto.iqamaNumber },
      });
      if (dup) throw new BadRequestException(`رقم الإقامة ${dto.iqamaNumber} مسجل مسبقاً.`);
    }

    const employeeSerial = await this.generateEmployeeSerial(dto.companyId);

    const emp = await this.prisma.employee.create({
      data: {
        tenantId,
        companyId:          dto.companyId,
        employeeSerial,
        name:               dto.name,
        nameEn:             dto.nameEn             ?? null,
        iqamaNumber:        dto.iqamaNumber        ?? null,
        jobTitle:           dto.jobTitle           ?? null,
        basicSalary:        new Prisma.Decimal(dto.basicSalary),
        housingAllowance:   new Prisma.Decimal(dto.housingAllowance   ?? 0),
        transportAllowance: new Prisma.Decimal(dto.transportAllowance ?? 0),
        otherAllowance:     new Prisma.Decimal(dto.otherAllowance     ?? 0),
        workHours:          dto.workHours   ?? null,
        workSchedule:       dto.workSchedule ?? null,
        joinDate:           new Date(dto.joinDate),
        status:             dto.status ?? 'active',
        notes:              dto.notes  ?? null,
      },
    });

    await this.audit.log({
      companyId: dto.companyId,
      userId,
      action:    'create',
      entity:    'employee',
      entityId:  emp.id,
      newValue:  { name: emp.name, basicSalary: String(emp.basicSalary) },
    });

    return emp;
  }

  async createBatch(dto: CreateBatchEmployeesDto, userId?: string) {
    const results = { created: 0, failed: 0, errors: [] as string[] };
    for (const item of dto.items) {
      try {
        const fullDto: CreateEmployeeDto = { ...item, companyId: dto.companyId };
        await this.create(fullDto, userId);
        results.created++;
      } catch (e: any) {
        results.failed++;
        results.errors.push(`${item.name}: ${e?.message || 'خطأ'}`);
      }
    }
    return results;
  }

  async update(id: string, dto: UpdateEmployeeDto, companyId: string, userId?: string) {
    const existing = await this.prisma.employee.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException(`الموظف ${id} غير موجود.`);

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...(dto.name               !== undefined && { name:               dto.name }),
        ...(dto.nameEn             !== undefined && { nameEn:             dto.nameEn }),
        ...(dto.iqamaNumber        !== undefined && { iqamaNumber:        dto.iqamaNumber }),
        ...(dto.jobTitle           !== undefined && { jobTitle:           dto.jobTitle }),
        ...(dto.basicSalary        !== undefined && { basicSalary:        new Prisma.Decimal(dto.basicSalary) }),
        ...(dto.housingAllowance   !== undefined && { housingAllowance:   new Prisma.Decimal(dto.housingAllowance) }),
        ...(dto.transportAllowance !== undefined && { transportAllowance: new Prisma.Decimal(dto.transportAllowance) }),
        ...(dto.otherAllowance     !== undefined && { otherAllowance:     new Prisma.Decimal(dto.otherAllowance) }),
        ...(dto.workHours          !== undefined && { workHours:          dto.workHours }),
        ...(dto.workSchedule       !== undefined && { workSchedule:       dto.workSchedule }),
        ...(dto.joinDate           !== undefined && { joinDate:           new Date(dto.joinDate) }),
        ...(dto.status             !== undefined && { status:             dto.status }),
        ...(dto.notes              !== undefined && { notes:              dto.notes }),
      },
    });

    await this.audit.log({
      companyId,
      userId,
      action:   'update',
      entity:   'employee',
      entityId: id,
      oldValue: { name: existing.name, status: existing.status },
      newValue: { name: updated.name,  status: updated.status  },
    });

    return updated;
  }

  async terminate(id: string, companyId: string, userId?: string) {
    const existing = await this.prisma.employee.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException(`الموظف ${id} غير موجود.`);
    if (existing.status === 'terminated') {
      throw new BadRequestException('الموظف منتهي الخدمة مسبقاً.');
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data:  { status: 'terminated', updatedAt: nowSaudi() },
    });

    await this.audit.log({
      companyId, userId, action: 'update', entity: 'employee', entityId: id,
      oldValue: { status: 'active' }, newValue: { status: 'terminated' },
    });

    return updated;
  }
}
