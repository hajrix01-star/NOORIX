import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }     from '../common/tenant-context';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async findAll(companyId: string, page = 1, pageSize = 50) {
    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where: { companyId, isDeleted: false },
        orderBy: { nameAr: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { supplierCategory: { include: { account: true } } },
      }),
      this.prisma.supplier.count({ where: { companyId, isDeleted: false } }),
    ]);
    return { items, total, page, pageSize };
  }

  async create(dto: CreateSupplierDto) {
    const tenantId  = TenantContext.getTenantId();
    const taxNumber = (dto.taxNumber ?? '').trim() || null;

    if (taxNumber) {
      const existing = await this.prisma.supplier.findFirst({
        where: { companyId: dto.companyId, taxNumber, isDeleted: false },
      });
      if (existing) {
        throw new BadRequestException('الرقم الضريبي مكرر لهذه الشركة');
      }
    }
    return this.prisma.supplier.create({
      data: {
        tenantId,
        companyId:          dto.companyId,
        nameAr:             dto.nameAr.trim(),
        nameEn:             (dto.nameEn ?? '').trim() || null,
        taxNumber,
        categoryId:         dto.supplierType ?? 'purchases',
        supplierCategoryId: dto.supplierCategoryId ?? null,
        phone:              (dto.phone ?? '').trim() || null,
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, companyId, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('المورد غير موجود');

    const taxNumber = (dto.taxNumber ?? '').trim() || null;
    if (taxNumber && taxNumber !== existing.taxNumber) {
      const dup = await this.prisma.supplier.findFirst({
        where: { companyId, taxNumber, isDeleted: false },
      });
      if (dup) throw new BadRequestException('الرقم الضريبي مكرر لهذه الشركة');
    }

    const data: Record<string, unknown> = {};
    if (dto.nameAr !== undefined) data.nameAr = dto.nameAr.trim();
    if (dto.nameEn !== undefined) data.nameEn = (dto.nameEn ?? '').trim() || null;
    if (dto.taxNumber !== undefined) data.taxNumber = taxNumber;
    if (dto.phone !== undefined) data.phone = (dto.phone ?? '').trim() || null;
    if (dto.supplierCategoryId !== undefined) data.supplierCategoryId = dto.supplierCategoryId || null;
    if (dto.supplierType !== undefined) data.categoryId = dto.supplierType;

    return this.prisma.supplier.update({
      where: { id },
      data,
      include: { supplierCategory: { include: { account: true } } },
    });
  }

  async remove(id: string, companyId: string) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, companyId, isDeleted: false },
    });
    if (!existing) throw new NotFoundException('المورد غير موجود');

    return this.prisma.supplier.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
