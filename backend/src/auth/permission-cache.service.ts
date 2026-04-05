/**
 * PermissionCacheService — كاش ذكي للصلاحيات.
 *
 * بدلاً من الاعتماد على JWT القديم، يقرأ الصلاحيات من قاعدة البيانات
 * مع كاش في الذاكرة (60 ثانية TTL) لتجنب ضغط على DB في كل طلب.
 *
 * عند تعديل دور من الإعدادات → invalidate() → الطلب التالي يجلب الصلاحيات الجديدة.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CacheEntry {
  permissions: string[];
  expiresAt: number;
}

const CACHE_TTL = 60_000; // 60 ثانية

@Injectable()
export class PermissionCacheService {
  private cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async getPermissions(roleName: string): Promise<string[]> {
    const key = roleName.toLowerCase();

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    const role = await this.prisma.role.findFirst({
      where: { name: key },
      select: { permissions: true },
    });

    const perms = Array.isArray(role?.permissions)
      ? (role.permissions as string[])
      : [];

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
