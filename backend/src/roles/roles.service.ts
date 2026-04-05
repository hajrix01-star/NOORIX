import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionCacheService } from '../auth/permission-cache.service';
import {
  PERMISSION_MODULES,
  PERMISSION_LEVELS,
  SYSTEM_ROLE_SEEDS,
} from '../auth/constants/permissions';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permCache: PermissionCacheService,
  ) {}

  /**
   * عند بدء التطبيق → يزرع الأدوار النظامية في DB إذا لم تكن موجودة
   * أو يملأ صلاحياتها إذا كانت فارغة.
   */
  async onModuleInit() {
    for (const [name, seed] of Object.entries(SYSTEM_ROLE_SEEDS)) {
      try {
        const existing = await this.prisma.role.findFirst({ where: { name } });
        if (!existing) {
          await this.prisma.role.create({
            data: {
              name,
              nameAr: seed.nameAr,
              permissions: seed.permissions,
              isSystem: true,
            },
          });
          this.logger.log(`Seeded system role: ${name}`);
        } else if (!Array.isArray(existing.permissions) || existing.permissions.length === 0) {
          await this.prisma.role.update({
            where: { id: existing.id },
            data: { permissions: seed.permissions, isSystem: true },
          });
          this.logger.log(`Filled permissions for system role: ${name}`);
        }
      } catch (e) {
        this.logger.warn(`Failed to seed role ${name}: ${e.message}`);
      }
    }
  }

  /** المصفوفة الكاملة — يُرسل للـ frontend عبر API */
  getPermissionsSchema() {
    return {
      modules: PERMISSION_MODULES,
      levels: PERMISSION_LEVELS,
    };
  }

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
