import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }  from '../common/tenant-context';
import { defaultCategoryReportingClass, isCategoryReportingClass, isReportingClassCompatibleWithCategoryType, type CategoryReportingClass } from './category-reporting-classification.util';

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
    reportingClass?: CategoryReportingClass;
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

    let type = dto.type || 'purchase';
    if (dto.reportingClass !== undefined && !isCategoryReportingClass(dto.reportingClass)) {
      throw new BadRequestException('تصنيف التقرير غير صالح');
    }
    let reportingClass = dto.reportingClass ?? defaultCategoryReportingClass(type);
    let accountId: string | null = null;
    let categoryCode: string | null = dto.code?.trim() || null;

    if (dto.parentId) {
      // ── فئة فرعية ──
      // ترث accountId من الأب (لا تُنشئ حساباً جديداً)
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, companyId: dto.companyId },
      });
      accountId = parent?.accountId ?? null;
      type = parent?.type ?? type;
      reportingClass = (parent?.reportingClass as CategoryReportingClass | undefined) ?? reportingClass;
      // توليد كود تحليلي تلقائي إن لم يُمرَّر يدوياً
      if (!categoryCode) {
        categoryCode = await this.generateChildCode(dto.companyId, dto.parentId);
      }
    } else if (dto.createAccount) {
      // ── فئة رئيسية جديدة → إنشاء حساب مرتبط ──
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
      if (!categoryCode) categoryCode = accountCode;
    }

    if (!isReportingClassCompatibleWithCategoryType(type, reportingClass)) {
      throw new BadRequestException('تصنيف التقرير لا يتوافق مع نوع الفئة.');
    }

    return this.prisma.category.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        accountId,
        code:      categoryCode || null,
        reportingClass,
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
    reportingClass?: CategoryReportingClass;
  }) {
    const cat = await this.prisma.category.findFirst({ where: { id, companyId } });
    if (!cat) throw new NotFoundException('التصنيف غير موجود');

    // فحص تكرار الاسم عند التعديل
    if (dto.nameAr !== undefined) {
      const targetParentId = dto.parentId !== undefined ? (dto.parentId || null) : cat.parentId;
      const duplicate = await this.prisma.category.findFirst({
        where: {
          companyId,
          nameAr:   dto.nameAr.trim(),
          parentId: targetParentId,
          isActive: true,
          NOT:      { id },
        },
      });
      if (duplicate) throw new BadRequestException('يوجد تصنيف بنفس الاسم على هذا المستوى');
    }

    if (dto.reportingClass !== undefined && !isCategoryReportingClass(dto.reportingClass)) {
      throw new BadRequestException('تصنيف التقرير غير صالح');
    }

    const targetType = dto.type ?? cat.type;
    const requestedReportingClass = dto.reportingClass ?? (dto.type !== undefined ? defaultCategoryReportingClass(targetType) : undefined);
    let newAccountId: string | null | undefined = undefined; // undefined = لا تغيير
    let newType: string | undefined = dto.type;
    let newReportingClass: CategoryReportingClass | undefined = requestedReportingClass;
    if (dto.parentId !== undefined) {
      if (dto.parentId) {
        if (dto.parentId === id) throw new BadRequestException('لا يمكن جعل التصنيف والداً لنفسه');
        const parent = await this.prisma.category.findFirst({
          where: { id: dto.parentId, companyId },
        });
        if (!parent) throw new BadRequestException('الفئة الأم غير موجودة');
        if (parent.parentId) throw new BadRequestException('لا يمكن إضافة فئة فرعية تحت فئة فرعية (مستويان فقط)');
        // الفئة الفرعية ترث accountId من الأب الجديد
        newAccountId = parent.accountId;
        newType = parent.type;
        newReportingClass = parent.reportingClass as CategoryReportingClass;
      } else {
        // تحويل إلى فئة رئيسية → لا حساب موروث (يبقى null حتى يُربط يدوياً)
        newAccountId = null;
      }
    }

    const finalType = newType ?? cat.type;
    const finalReportingClass = newReportingClass ?? (cat.reportingClass as CategoryReportingClass);
    if (!isReportingClassCompatibleWithCategoryType(finalType, finalReportingClass)) {
      throw new BadRequestException('تصنيف التقرير لا يتوافق مع نوع الفئة.');
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.nameAr     !== undefined ? { nameAr:    dto.nameAr.trim() }          : {}),
        ...(dto.nameEn     !== undefined ? { nameEn:    dto.nameEn?.trim() || null }  : {}),
        ...(newType        !== undefined ? { type:      newType }                     : {}),
        ...(dto.parentId   !== undefined ? { parentId:  dto.parentId || null }        : {}),
        ...(newAccountId   !== undefined ? { accountId: newAccountId }                : {}),
        ...(newReportingClass !== undefined ? { reportingClass: newReportingClass } : {}),
        ...(dto.icon       !== undefined ? { icon:      dto.icon }                    : {}),
        ...(dto.sortOrder  !== undefined ? { sortOrder: dto.sortOrder }               : {}),
        ...(dto.isActive   !== undefined ? { isActive:  dto.isActive }                : {}),
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
