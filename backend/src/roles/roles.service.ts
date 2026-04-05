import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionCacheService } from '../auth/permission-cache.service';

const SYSTEM_ROLES = ['owner', 'super_admin', 'accountant', 'cashier'];

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permCache: PermissionCacheService,
  ) {}

  findAll() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  }

  async create(data: { name: string; nameAr?: string; description?: string; permissions: string[] }) {
    const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
    if (existing) throw new BadRequestException('اسم الدور مستخدم مسبقاً');
    return this.prisma.role.create({
      data: {
        name: data.name.toLowerCase().trim(),
        nameAr: data.nameAr?.trim() || null,
        description: data.description?.trim() || null,
        permissions: data.permissions || [],
        isSystem: false,
      },
    });
  }

  async update(id: string, data: { nameAr?: string; description?: string; permissions?: string[] }) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('الدور غير موجود');
    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        nameAr: data.nameAr !== undefined ? data.nameAr.trim() || null : undefined,
        description: data.description !== undefined ? data.description.trim() || null : undefined,
        permissions: data.permissions !== undefined ? data.permissions : undefined,
      },
    });
    // إبطال كاش الصلاحيات فوراً → التغييرات تنفّذ بدون إعادة تسجيل دخول
    this.permCache.invalidate(role.name);
    return updated;
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('الدور غير موجود');
    if (role.isSystem) throw new BadRequestException('لا يمكن حذف الأدوار النظامية الأساسية');
    if (role._count.users > 0)
      throw new BadRequestException(`لا يمكن حذف الدور — يوجد ${role._count.users} مستخدم مرتبط به`);
    return this.prisma.role.delete({ where: { id } });
  }
}
