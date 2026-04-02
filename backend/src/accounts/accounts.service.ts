import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';

/**
 * الحسابات النظامية محمية من التعديل والحذف.
 * الحماية مزدوجة:
 *  1. أكواد تبدأ بـ SYS- محجوزة للنظام.
 *  2. أي حساب مرتبط بخزينة نشطة أو قيود محاسبية لا يُحذف.
 */
const SYSTEM_CODE_PREFIX = 'SYS-';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.account.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
  }

  async findOne(id: string, companyId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, companyId },
    });
    if (!account) throw new NotFoundException('الحساب غير موجود');
    return account;
  }

  async create(dto: {
    companyId: string;
    code: string;
    nameAr: string;
    nameEn?: string;
    type: string;
    icon?: string;
    taxExempt?: boolean;
  }) {
    const tenantId = TenantContext.getTenantId();
    const code = dto.code.trim().toUpperCase();

    if (!dto.nameAr?.trim()) throw new BadRequestException('اسم الحساب بالعربية مطلوب');

    const existing = await this.prisma.account.findFirst({
      where: { companyId: dto.companyId, code },
    });
    if (existing) throw new BadRequestException('رمز الحساب مستخدم مسبقاً في هذه الشركة');

    return this.prisma.account.create({
      data: {
        tenantId,
        companyId:  dto.companyId,
        code,
        nameAr:     dto.nameAr.trim(),
        nameEn:     dto.nameEn?.trim() || null,
        type:       dto.type,
        icon:       dto.icon || null,
        taxExempt:  dto.taxExempt ?? false,
        isActive:   true,
      },
    });
  }

  async update(
    id: string,
    companyId: string,
    dto: {
      nameAr?: string;
      nameEn?: string | null;
      type?: string;
      icon?: string | null;
      taxExempt?: boolean;
      isActive?: boolean;
    },
  ) {
    const account = await this.findOne(id, companyId);
    this.guardSystemCode(account.code);

    return this.prisma.account.update({
      where: { id },
      data: {
        ...(dto.nameAr    !== undefined ? { nameAr: dto.nameAr.trim() }           : {}),
        ...(dto.nameEn    !== undefined ? { nameEn: dto.nameEn?.trim() || null }  : {}),
        ...(dto.type      !== undefined ? { type: dto.type }                      : {}),
        ...(dto.icon      !== undefined ? { icon: dto.icon }                      : {}),
        ...(dto.taxExempt !== undefined ? { taxExempt: dto.taxExempt }            : {}),
        ...(dto.isActive  !== undefined ? { isActive: dto.isActive }              : {}),
      },
    });
  }

  async remove(id: string, companyId: string) {
    const account = await this.findOne(id, companyId);
    this.guardSystemCode(account.code);

    const [debitCount, creditCount, vaultCount] = await Promise.all([
      this.prisma.ledgerEntry.count({
        where: { companyId, debitAccountId: id, status: 'active' },
      }),
      this.prisma.ledgerEntry.count({
        where: { companyId, creditAccountId: id, status: 'active' },
      }),
      this.prisma.vault.count({
        where: { companyId, accountId: id, isArchived: false },
      }),
    ]);

    if (debitCount + creditCount > 0)
      throw new BadRequestException('لا يمكن حذف حساب مرتبط بقيود محاسبية نشطة');
    if (vaultCount > 0)
      throw new BadRequestException('لا يمكن حذف حساب مرتبط بخزينة نشطة');

    return this.prisma.account.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private guardSystemCode(code: string) {
    if (code.startsWith(SYSTEM_CODE_PREFIX)) {
      throw new BadRequestException('لا يمكن تعديل أو حذف الحسابات النظامية');
    }
  }
}
