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

  private employeeListSelect = {
    id: true, employeeSerial: true, name: true, nameEn: true, jobTitle: true,
    basicSalary: true, housingAllowance: true, transportAllowance: true, otherAllowance: true,
    workHours: true, workSchedule: true,
    iqamaNumber: true, joinDate: true, status: true, notes: true,
    createdAt: true,
  } as const;

  /** قائمة كاملة (حد أقصى) — للتوافق مع العملاء القدامى والقوائم المنسدلة */
  async findAllLegacy(companyId: string, includeTerminated = false, maxRows = 5000) {
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      ...(includeTerminated ? {} : { status: { notIn: ['terminated', 'archived'] } }),
    };
    return this.prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
      take:    maxRows,
      select:  this.employeeListSelect,
    });
  }

  private whereForTab(
    companyId: string,
    tab: 'active' | 'terminated' | 'archived',
    q?: string,
  ): Prisma.EmployeeWhereInput {
    const where: Prisma.EmployeeWhereInput = { companyId };
    if (tab === 'active') {
      where.status = { notIn: ['terminated', 'archived'] };
    } else if (tab === 'terminated') {
      where.status = 'terminated';
    } else {
      where.status = 'archived';
    }
    const needle = (q || '').trim();
    if (needle.length > 0) {
      where.OR = [
        { name: { contains: needle, mode: 'insensitive' } },
        { nameEn: { contains: needle, mode: 'insensitive' } },
        { employeeSerial: { contains: needle, mode: 'insensitive' } },
        { jobTitle: { contains: needle, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private orderByFor(
    sortBy?: string,
    sortDir?: string,
  ): Prisma.EmployeeOrderByWithRelationInput {
    const dir = sortDir === 'asc' ? 'asc' : 'desc';
    switch (sortBy) {
      case 'employeeSerial': return { employeeSerial: dir };
      case 'name':           return { name: dir };
      case 'jobTitle':       return { jobTitle: dir };
      case 'joinDate':       return { joinDate: dir };
      case 'totalSalary':
      case 'basicSalary':    return { basicSalary: dir };
      case 'status':         return { status: dir };
      default:               return { joinDate: 'desc' };
    }
  }

  /** تصدير / تحميل مجمّع حسب التبويب (حد أقصى) */
  async findAllBulk(companyId: string, tab: 'active' | 'terminated' | 'archived', maxRows = 10000) {
    const where = this.whereForTab(companyId, tab);
    return this.prisma.employee.findMany({
      where,
      orderBy: this.orderByFor('name', 'asc'),
      take:    maxRows,
      select:  this.employeeListSelect,
    });
  }

  async findPaged(
    companyId: string,
    tab: 'active' | 'terminated' | 'archived',
    page = 1,
    pageSize = 50,
    q?: string,
    sortBy?: string,
    sortDir?: string,
  ) {
    const size = Math.min(200, Math.max(1, pageSize));
    const p = Math.max(1, page);
    const where = this.whereForTab(companyId, tab, q);
    const skip = (p - 1) * size;
    const orderBy = this.orderByFor(sortBy, sortDir);
    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        orderBy,
        skip,
        take:   size,
        select: this.employeeListSelect,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { items, total, page: p, pageSize: size };
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
