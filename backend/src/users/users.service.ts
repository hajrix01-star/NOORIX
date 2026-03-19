import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }  from '../common/tenant-context';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        nameAr: true,
        nameEn: true,
        isActive: true,
        createdAt: true,
        role: { select: { id: true, name: true, nameAr: true } },
        userCompanies: { select: { companyId: true, company: { select: { id: true, nameAr: true } } } },
      },
    });
  }

  async create(data: {
    email: string;
    password: string;
    nameAr?: string;
    nameEn?: string;
    roleName: string;
    companyIds: string[];
  }) {
    const email = data.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('البريد الإلكتروني أو اسم المستخدم مسجّل مسبقاً');

    const role = await this.prisma.role.findFirst({ where: { name: data.roleName } });
    if (!role) throw new ConflictException('الدور غير موجود');

    const tenantId     = TenantContext.getTenantId();
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        nameAr: data.nameAr?.trim() || null,
        nameEn: data.nameEn?.trim() || null,
        roleId: role.id,
      },
    });

    for (const companyId of data.companyIds || []) {
      await this.prisma.userCompany.upsert({
        where: { userId_companyId: { userId: user.id, companyId } },
        update: {},
        create: { userId: user.id, companyId },
      });
    }

    return this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, email: true, nameAr: true, nameEn: true, isActive: true,
        role: { select: { id: true, name: true, nameAr: true } },
        userCompanies: { select: { companyId: true, company: { select: { id: true, nameAr: true } } } },
      },
    });
  }

  async update(
    id: string,
    data: {
      nameAr?: string;
      nameEn?: string;
      roleName?: string;
      password?: string;
      companyIds?: string[];
    },
    currentUserId: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const updateData: Record<string, unknown> = {};
    if (data.nameAr !== undefined) updateData.nameAr = data.nameAr?.trim() || null;
    if (data.nameEn !== undefined) updateData.nameEn = data.nameEn?.trim() || null;

    if (data.password?.trim()) {
      updateData.passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    }

    if (data.roleName) {
      const role = await this.prisma.role.findFirst({ where: { name: data.roleName } });
      if (!role) throw new BadRequestException('الدور غير موجود');
      updateData.roleId = role.id;
    }

    await this.prisma.user.update({ where: { id }, data: updateData });

    if (Array.isArray(data.companyIds)) {
      await this.prisma.userCompany.deleteMany({ where: { userId: id } });
      for (const companyId of data.companyIds) {
        await this.prisma.userCompany.create({ data: { userId: id, companyId } });
      }
    }

    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, nameAr: true, nameEn: true, isActive: true,
        role: { select: { id: true, name: true, nameAr: true } },
        userCompanies: { select: { companyId: true, company: { select: { id: true, nameAr: true } } } },
      },
    });
  }

  async archive(id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('لا يمكنك أرشفة حسابك الحالي');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });
  }

  async restore(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, email: true, isActive: true },
    });
  }

  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) throw new BadRequestException('لا يمكنك حذف حسابك الحالي');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    // حذف ناعم: تعطيل الحساب فقط (لا حذف فعلي لضمان سجل التدقيق)
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false, email: `deleted_${Date.now()}_${user.email}` },
      select: { id: true, email: true },
    });
  }
}
