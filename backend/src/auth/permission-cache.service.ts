/**
 * PermissionCacheService — كاش ذكي للصلاحيات.
 *
 * بدلاً من الاعتماد على JWT القديم، يقرأ الصلاحيات من قاعدة البيانات
 * مع كاش في الذاكرة (60 ثانية TTL) لتجنب ضغط على DB في كل طلب.
 *
 * عند تعديل دور من الإعدادات → invalidate() → الطلب التالي يجلب الصلاحيات الجديدة.
 *
 * Self-healing: إذا كانت صلاحيات seed جديدة مفقودة من الدور النظامي،
 * تُضاف تلقائياً دون الحاجة لإعادة تشغيل الخادم.
 */
import { Global, Module, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_ROLE_SEEDS } from './constants/permissions';

interface CacheEntry {
  permissions: string[];
  expiresAt: number;
}

const CACHE_TTL = 60_000; // 60 ثانية

@Injectable()
export class PermissionCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly logger = new Logger(PermissionCacheService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPermissions(roleName: string): Promise<string[]> {
    const key = roleName.toLowerCase();

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    const role = await this.prisma.role.findFirst({
      where: { name: key },
      select: { id: true, permissions: true, lastSeedPermissions: true },
    });

    let perms = Array.isArray(role?.permissions)
      ? (role.permissions as string[])
      : [];

    // Self-healing: إضافة أي صلاحيات seed جديدة للأدوار النظامية دون إعادة تشغيل
    if (role && SYSTEM_ROLE_SEEDS[key]) {
      const seed = SYSTEM_ROLE_SEEDS[key];
      const lastSeedPerms = Array.isArray(role.lastSeedPermissions)
        ? (role.lastSeedPermissions as string[])
        : [];
      const trulyNewPerms = seed.permissions.filter((p) => !lastSeedPerms.includes(p));

      if (trulyNewPerms.length > 0) {
        const merged = [...new Set([...perms, ...trulyNewPerms])];
        // تحديث DB في الخلفية (بدون انتظار حتى لا يُبطئ الطلب)
        this.prisma.role
          .update({
            where: { id: role.id },
            data: { permissions: merged, lastSeedPermissions: seed.permissions },
          })
          .then(() =>
            this.logger.log(
              `Auto-healed ${trulyNewPerms.length} perm(s) for role "${key}": [${trulyNewPerms.join(', ')}]`,
            ),
          )
          .catch((e) =>
            this.logger.warn(`Permission auto-heal failed for "${key}": ${e?.message}`),
          );
        perms = merged;
      }
    }

    this.cache.set(key, {
      permissions: perms,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return perms;
  }

  /** إبطال كاش دور معين أو كل الأدوار */
  invalidate(roleName?: string) {
    if (roleName) {
      this.cache.delete(roleName.toLowerCase());
    } else {
      this.cache.clear();
    }
  }
}

@Global()
@Module({
  providers: [PermissionCacheService],
  exports:  [PermissionCacheService],
})
export class PermissionCacheModule {}
