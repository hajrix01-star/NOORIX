import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }    from '../common/tenant-context';
import { AccountingInitService } from '../accounting-init/accounting-init.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly accountingInit: AccountingInitService,
  ) {}

  async create(dto: CreateCompanyDto) {
    const tenantId = TenantContext.getTenantId();
    const company = await this.prisma.withTenant(async (tx) => {
      const last = await tx.company.aggregate({
        where: { isArchived: false },
        _max: { sortOrder: true },
      });
      return tx.company.create({
        data: {
          tenantId,
          nameAr:    dto.nameAr.trim(),
          nameEn:    (dto.nameEn    ?? '').trim() || null,
          logoUrl:   dto.logoUrl   ?? null,
          phone:     (dto.phone    ?? '').trim() || null,
          address:   (dto.address  ?? '').trim() || null,
          taxNumber: (dto.taxNumber ?? '').trim() || null,
          email:     (dto.email    ?? '').trim() || null,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
        },
      });
    });
    await this.accountingInit.initializeCompanyAccounting(tenantId, company.id);
    return company;
  }

  async findAll(includeArchived = false, allowedCompanyIds?: string[] | null) {
    const where: { isArchived?: boolean; id?: { in: string[] } } = includeArchived ? {} : { isArchived: false };
    if (Array.isArray(allowedCompanyIds) && allowedCompanyIds.length > 0) {
      where.id = { in: allowedCompanyIds };
    }
    return this.prisma.company.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: [{ isArchived: 'asc' }, { sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  }

  async findOne(id: string) {
    return this.prisma.company.findUniqueOrThrow({
      where: { id },
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const data: Record<string, unknown> = {};
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr.trim();
    if (dto.nameEn !== undefined) data.nameEn = (dto.nameEn ?? '').trim() || null;
    if (dto.logoUrl !== undefined) data.logoUrl = (dto.logoUrl ?? '').trim() || null;
    if (dto.phone !== undefined) data.phone = (dto.phone ?? '').trim() || null;
    if (dto.address !== undefined) data.address = (dto.address ?? '').trim() || null;
    if (dto.taxNumber !== undefined) data.taxNumber = (dto.taxNumber ?? '').trim() || null;
    if (dto.email !== undefined) data.email = (dto.email ?? '').trim() || null;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;
    if (dto.vatEnabledForSales !== undefined) data.vatEnabledForSales = dto.vatEnabledForSales;
    if (dto.vatRatePercent !== undefined) data.vatRatePercent = dto.vatRatePercent;
    if (dto.salesShiftsEnabled !== undefined) data.salesShiftsEnabled = dto.salesShiftsEnabled;
    const requiresOrderNormalization = dto.sortOrder !== undefined || dto.isArchived !== undefined;
    if (!requiresOrderNormalization) {
      return this.prisma.company.update({
        where: { id },
        data: data as Parameters<TenantPrismaService['company']['update']>[0]['data'],
      });
    }

    return this.prisma.withTenant(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.company.update({
          where: { id },
          data: data as Parameters<TenantPrismaService['company']['update']>[0]['data'],
        });
      }

      const activeCompanies = await tx.company.findMany({
        where: { isArchived: false },
        select: { id: true, sortOrder: true },
        orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      const target = activeCompanies.find((company) => company.id === id);
      const ordered = target
        ? activeCompanies.filter((company) => company.id !== id)
        : activeCompanies.slice();
      if (target) {
        const requested = dto.sortOrder ?? target.sortOrder;
        const targetIndex = Math.max(0, Math.min(ordered.length, requested - 1));
        ordered.splice(targetIndex, 0, target);
      }

      for (const [index, company] of ordered.entries()) {
        const nextOrder = index + 1;
        if (company.sortOrder === nextOrder) continue;
        await tx.company.update({ where: { id: company.id }, data: { sortOrder: nextOrder } });
      }

      return tx.company.findUniqueOrThrow({ where: { id } });
    });
  }

  async remove(id: string) {
    const [invoiceCount, employeeCount, vaultCount] = await Promise.all([
      this.prisma.invoice.count({ where: { companyId: id } }),
      this.prisma.employee.count({ where: { companyId: id } }),
      this.prisma.vault.count({ where: { companyId: id } }),
    ]);

    if (invoiceCount > 0) {
      throw new BadRequestException(
        `لا يمكن حذف الشركة — لديها ${invoiceCount} معاملة مالية. استخدم الأرشفة بدلاً من الحذف.`,
      );
    }
    if (employeeCount > 0) {
      throw new BadRequestException(
        `لا يمكن حذف الشركة — لديها ${employeeCount} موظف. أنهِ خدماتهم أولاً أو استخدم الأرشفة.`,
      );
    }
    if (vaultCount > 0) {
      throw new BadRequestException(
        `لا يمكن حذف الشركة — لديها ${vaultCount} خزينة مرتبطة. استخدم الأرشفة بدلاً من الحذف.`,
      );
    }

    return this.prisma.company.delete({ where: { id } });
  }
}
