/**
 * ExpenseLineService — إدارة بنود المصاريف (هاتف 1، كهرب 1، إيجار محل)
 * لكل بند سجل مدفوعات خاص
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { CreateExpenseLineDto } from './dto/create-expense-line.dto';
import { UpdateExpenseLineDto } from './dto/update-expense-line.dto';

@Injectable()
export class ExpenseLineService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async findAll(
    companyId: string,
    kind?: 'fixed_expense' | 'expense',
    includeInactive = false,
  ) {
    const where: { companyId: string; isActive?: boolean; kind?: string } = { companyId };
    if (!includeInactive) where.isActive = true;
    if (kind) where.kind = kind;

    return this.prisma.expenseLine.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { nameAr: 'asc' }],
      include: {
        category: { select: { id: true, nameAr: true, nameEn: true, accountId: true, account: true } },
        supplier: { select: { id: true, nameAr: true, nameEn: true } },
      },
    });
  }

  async findOne(id: string, companyId: string) {
    const line = await this.prisma.expenseLine.findFirst({
      where: { id, companyId },
      include: {
        category: { select: { id: true, nameAr: true, nameEn: true, accountId: true, account: true } },
        supplier: { select: { id: true, nameAr: true, nameEn: true, phone: true } },
      },
    });
    if (!line) throw new NotFoundException('بند المصروف غير موجود');
    return line;
  }

  async getPayments(
    id: string,
    companyId: string,
    startDate?: string,
    endDate?: string,
    page = 1,
    pageSize = 50,
  ) {
    const line = await this.findOne(id, companyId);

    const dateFilter =
      startDate || endDate
        ? {
            transactionDate: {
              ...(startDate ? { gte: new Date(`${String(startDate).slice(0, 10)}T00:00:00.000Z`) } : {}),
              ...(endDate ? { lte: new Date(`${String(endDate).slice(0, 10)}T23:59:59.999Z`) } : {}),
            },
          }
        : {};

    const where = {
      companyId,
      expenseLineId: id,
      status: 'active',
      ...dateFilter,
    };

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { supplier: true, vault: true },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      expenseLine: line,
      items,
      total,
      page,
      pageSize,
    };
  }

  async create(dto: CreateExpenseLineDto) {
    const tenantId = TenantContext.getTenantId();

    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, companyId: dto.companyId, type: 'expense' },
    });
    if (!category) throw new BadRequestException('الفئة غير موجودة أو ليست من نوع مصروفات');

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, companyId: dto.companyId, isDeleted: false },
    });
    if (!supplier) throw new BadRequestException('المورد غير موجود');

    return this.prisma.expenseLine.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        nameAr: dto.nameAr.trim(),
        nameEn: (dto.nameEn ?? '').trim() || null,
        kind: dto.kind,
        categoryId: dto.categoryId,
        supplierId: dto.supplierId,
        serviceNumber: (dto.serviceNumber ?? '').trim() || null,
        notes: (dto.notes ?? '').trim() || null,
        isActive: dto.isActive !== false,
      },
      include: {
        category: { select: { id: true, nameAr: true, accountId: true } },
        supplier: { select: { id: true, nameAr: true } },
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateExpenseLineDto) {
    const existing = await this.findOne(id, companyId);

    if (dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, companyId, type: 'expense' },
      });
      if (!cat) throw new BadRequestException('الفئة غير موجودة أو ليست من نوع مصروفات');
    }
    if (dto.supplierId) {
      const sup = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, companyId, isDeleted: false },
      });
      if (!sup) throw new BadRequestException('المورد غير موجود');
    }

    const data: Record<string, unknown> = {};
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr.trim();
    if (dto.nameEn !== undefined) data.nameEn = (dto.nameEn ?? '').trim() || null;
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.supplierId !== undefined) data.supplierId = dto.supplierId;
    if (dto.serviceNumber !== undefined) data.serviceNumber = (dto.serviceNumber ?? '').trim() || null;
    if (dto.notes !== undefined) data.notes = (dto.notes ?? '').trim() || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.expenseLine.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, nameAr: true, accountId: true } },
        supplier: { select: { id: true, nameAr: true } },
      },
    });
  }

  async deactivate(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.expenseLine.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
