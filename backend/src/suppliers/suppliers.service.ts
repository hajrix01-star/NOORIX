import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }     from '../common/tenant-context';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async findAll(companyId: string, page = 1, pageSize = 50, q?: string) {
    const needle = (q || '').trim().slice(0, 120);
    const searchFilter: Prisma.SupplierWhereInput =
      needle.length > 0
        ? {
            OR: [
              { nameAr: { contains: needle, mode: 'insensitive' } },
              { nameEn: { contains: needle, mode: 'insensitive' } },
              { taxNumber: { contains: needle, mode: 'insensitive' } },
              { phone: { contains: needle, mode: 'insensitive' } },
            ],
          }
        : {};
    const where = { companyId, isDeleted: false, ...searchFilter };
    const size = Math.min(200, Math.max(1, pageSize));
    const p = Math.max(1, page);
    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { nameAr: 'asc' },
        skip: (p - 1) * size,
        take: size,
        include: { supplierCategory: { include: { account: true } } },
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items, total, page: p, pageSize: size };
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
