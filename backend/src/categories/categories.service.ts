import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }  from '../common/tenant-context';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async findAll(companyId: string) {
    const all = await this.prisma.category.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
      include: {
        account:  true,
        children: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }], include: { account: true } },
      },
    });
    // أعِد الفئات الأم فقط (تحتوي على أبنائها عبر include)
    return all.filter((c) => !c.parentId);
  }

  async create(dto: {
    companyId:     string;
    nameAr:        string;
    nameEn?:       string;
    parentId?:    string;
    type?:        string;
    icon?:        string;
    sortOrder?:   number;
    createAccount?: boolean;  // عند true: إنشاء Account مطابق + ربط Category به (للفئات P&L)
  }) {
    const tenantId = TenantContext.getTenantId();
    if (!dto.nameAr?.trim()) throw new BadRequestException('اسم التصنيف بالعربية مطلوب');

    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, companyId: dto.companyId },
      });
      if (!parent) throw new BadRequestException('الفئة الأم غير موجودة');
      if (parent.parentId) throw new BadRequestException('لا يمكن إضافة فئة فرعية تحت فئة فرعية (مستويان فقط)');
    }

    const type = dto.type || 'purchase';
    let accountId: string | null = null;

    if (dto.createAccount) {
      const accountType = type === 'sale' ? 'revenue' : type === 'purchase' ? 'expense' : 'expense';
      const prefix = type === 'sale' ? 'REV' : type === 'purchase' ? 'PUR' : 'EXP';
      const existing = await this.prisma.account.findMany({
        where: { companyId: dto.companyId, code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
        take: 1,
      });
      const nextNum = existing.length
        ? parseInt(existing[0].code.replace(/\D/g, ''), 10) + 1
        : type === 'sale' ? 2 : type === 'purchase' ? 2 : 7;
      const code = `${prefix}-${String(nextNum).padStart(3, '0')}`;
      const account = await this.prisma.account.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          code,
          nameAr:    dto.nameAr.trim(),
          nameEn:    dto.nameEn?.trim() || null,
          type:      accountType,
          icon:      dto.icon || '📁',
          taxExempt: false,
          isActive:  true,
        },
      });
      accountId = account.id;
    }

    return this.prisma.category.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        accountId,
        nameAr:    dto.nameAr.trim(),
        nameEn:    dto.nameEn?.trim() || null,
        parentId:  dto.parentId || null,
        type,
        icon:      dto.icon || null,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { account: true },
    });
  }

  async update(id: string, companyId: string, dto: {
    nameAr?: string;
    nameEn?: string | null;
    type?: string;
    parentId?: string | null;
    icon?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const cat = await this.prisma.category.findFirst({ where: { id, companyId } });
    if (!cat) throw new NotFoundException('التصنيف غير موجود');

    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        if (dto.parentId === id) throw new BadRequestException('لا يمكن جعل التصنيف والداً لنفسه');
        const parent = await this.prisma.category.findFirst({
          where: { id: dto.parentId, companyId },
        });
        if (!parent) throw new BadRequestException('الفئة الأم غير موجودة');
        if (parent.parentId) throw new BadRequestException('لا يمكن إضافة فئة فرعية تحت فئة فرعية (مستويان فقط)');
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr.trim() } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn?.trim() || null } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId || null } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string, companyId: string) {
    const cat = await this.prisma.category.findFirst({
      where: { id, companyId },
      include: { children: { where: { isActive: true } }, suppliers: { where: { isDeleted: false } } },
    });
    if (!cat) throw new NotFoundException('التصنيف غير موجود');
    if (cat.children.length > 0) throw new BadRequestException('لا يمكن حذف فئة تحتوي على فئات فرعية');
    if (cat.suppliers.length > 0) throw new BadRequestException('لا يمكن حذف فئة مرتبطة بموردين');

    return this.prisma.category.update({ where: { id }, data: { isActive: false } });
  }
}
