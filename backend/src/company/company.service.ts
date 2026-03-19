import { Injectable } from '@nestjs/common';
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
    const company = await this.prisma.company.create({
      data: {
        tenantId,
        nameAr:    dto.nameAr.trim(),
        nameEn:    (dto.nameEn    ?? '').trim() || null,
        logoUrl:   dto.logoUrl   ?? null,
        phone:     (dto.phone    ?? '').trim() || null,
        address:   (dto.address  ?? '').trim() || null,
        taxNumber: (dto.taxNumber ?? '').trim() || null,
        email:     (dto.email    ?? '').trim() || null,
      },
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
      orderBy: { nameAr: 'asc' },
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
    return this.prisma.company.update({
      where: { id },
      data: data as Parameters<TenantPrismaService['company']['update']>[0]['data'],
    });
  }

  async remove(id: string) {
    return this.prisma.company.delete({ where: { id } });
  }
}
