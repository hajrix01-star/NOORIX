import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }  from '../common/tenant-context';

/**
 * يستخلص بادئة الكود التحليلي من كود الحساب.
 * PUR-001 → P1 | PUR-002 → P2 | EXP-003 → E3 | REV-001 → R1
 */
function deriveParentPrefix(accountCode: string): string {
  const match = accountCode.match(/^([A-Z]+)-(\d+)$/);
  if (!match) return 'C';
  const letter = match[1][0]; // أول حرف: P أو E أو R
  const num    = parseInt(match[2], 10); // الرقم بدون أصفار
  return `${letter}${num}`;
}

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

  /** يولّد كوداً تحليلياً فريداً للفئة الفرعية مثل P1-1، E3-2 */
  private async generateChildCode(companyId: string, parentId: string): Promise<string> {
    const parent = await this.prisma.category.findFirst({
      where: { id: parentId, companyId },
      include: { account: true },
    });
    if (!parent) return '';

    const prefix = parent.account?.code
      ? deriveParentPrefix(parent.account.code)
      : (parent.code ?? 'C');

    // احسب عدد الأبناء الحاليين لتحديد الرقم التسلسلي
    const siblingsCount = await this.prisma.category.count({
      where: { companyId, parentId, isActive: true },
    });
    const seq = siblingsCount + 1;

    // تأكد أن الكود فريد (نادراً ما يتعارض، لكن احتياط)
    let candidate = `${prefix}-${seq}`;
    let attempt   = seq;
    while (true) {
      const exists = await this.prisma.category.findFirst({
        where: { companyId, code: candidate },
      });
      if (!exists) break;
      attempt++;
      candidate = `${prefix}-${attempt}`;
    }
    return candidate;
  }

  async create(dto: {
    companyId:      string;
    nameAr:         string;
    nameEn?:        string;
    parentId?:      string;
    type?:          string;
    icon?:          string;
    sortOrder?:     number;
    code?:          string;          // كود يدوي اختياري
    createAccount?: boolean;         // إنشاء Account مطابق + ربط Category به
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

    const duplicate = await this.prisma.category.findFirst({
      where: {
        companyId: dto.companyId,
        nameAr: dto.nameAr.trim(),
        parentId: dto.parentId || null,
        isActive: true,
      },
    });
    if (duplicate) throw new BadRequestException('يوجد تصنيف بنفس الاسم على هذا المستوى');

    const type = dto.type || 'purchase';
    let accountId: string | null = null;
    let categoryCode: string | null = dto.code?.trim() || null;

    if (dto.createAccount) {
      const accountType = type === 'sale' ? 'revenue' : 'expense';
      const prefix = type === 'sale' ? 'REV' : type === 'purchase' ? 'PUR' : 'EXP';
      const existing = await this.prisma.account.findMany({
        where: { companyId: dto.companyId, code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
        take: 1,
      });
      const nextNum = existing.length
        ? parseInt(existing[0].code.replace(/\D/g, ''), 10) + 1
        : type === 'sale' ? 2 : type === 'purchase' ? 2 : 7;
      const accountCode = `${prefix}-${String(nextNum).padStart(3, '0')}`;
      const account = await this.prisma.account.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          code:      accountCode,
          nameAr:    dto.nameAr.trim(),
          nameEn:    dto.nameEn?.trim() || null,
          type:      accountType,
          icon:      dto.icon || '📁',
          taxExempt: false,
          isActive:  true,
        },
      });
      accountId = account.id;
      // الفئة الرئيسية تأخذ كودها من كود الحساب
      if (!categoryCode) categoryCode = accountCode;
    } else if (dto.parentId && !categoryCode) {
      // فئة فرعية → توليد كود تحليلي تلقائي
      categoryCode = await this.generateChildCode(dto.companyId, dto.parentId);
    }

    return this.prisma.category.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        accountId,
        code:      categoryCode || null,
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
        ...(dto.nameAr    !== undefined ? { nameAr:    dto.nameAr.trim() }        : {}),
        ...(dto.nameEn    !== undefined ? { nameEn:    dto.nameEn?.trim() || null } : {}),
        ...(dto.type      !== undefined ? { type:      dto.type }                  : {}),
        ...(dto.parentId  !== undefined ? { parentId:  dto.parentId || null }      : {}),
        ...(dto.icon      !== undefined ? { icon:      dto.icon }                  : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder }             : {}),
        ...(dto.isActive  !== undefined ? { isActive:  dto.isActive }              : {}),
      },
    });
  }

  async remove(id: string, companyId: string) {
    const cat = await this.prisma.category.findFirst({
      where: { id, companyId },
      include: {
        children:     { where: { isActive: true } },
        suppliers:    { where: { isDeleted: false } },
        expenseLines: { where: { isActive: true } },
      },
    });
    if (!cat) throw new NotFoundException('التصنيف غير موجود');
    if (cat.children.length > 0)
      throw new BadRequestException('لا يمكن حذف فئة تحتوي على فئات فرعية نشطة');
    if (cat.suppliers.length > 0)
      throw new BadRequestException(
        `لا يمكن حذف فئة مرتبطة بـ ${cat.suppliers.length} مورد`,
      );
    if (cat.expenseLines.length > 0)
      throw new BadRequestException(
        `لا يمكن حذف فئة مرتبطة بـ ${cat.expenseLines.length} بند مصروف نشط`,
      );

    return this.prisma.category.update({ where: { id }, data: { isActive: false } });
  }
}
