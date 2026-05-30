/**
 * RolesGuard — يفرض الأدوار والصلاحيات على الـ Endpoints.
 *
 * ✅ يقرأ الصلاحيات الحية من DB عبر PermissionCacheService (كاش 60 ثانية)
 *    بدلاً من الاعتماد فقط على JWT القديم.
 * ✅ يدمج صلاحيات DB الحية مع الصلاحيات الثابتة للأدوار النظامية.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PERMISSIONS_ANY_KEY } from '../decorators/require-any-permission.decorator';
import { hasPermission } from '../constants/permissions';
import { PermissionCacheService } from '../permission-cache.service';
import type { Permission } from '../constants/permissions';

interface RequestUser {
  role?: string;
  permissions?: string[];
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permCache: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;
    const role = (user?.role || '').toLowerCase();

    // جلب الصلاحيات الحية من DB (مع كاش 60 ثانية) — مصدر الحقيقة الوحيد
    let livePermissions: string[] = [];
    if (role) {
      try {
        livePermissions = await this.permCache.getPermissions(role);
        if (user) user.permissions = livePermissions;
      } catch {
        throw new ForbiddenException('تعذّر التحقق من الصلاحيات.');
      }
    } else {
      livePermissions = user?.permissions || [];
    }

    // ── فحص @RequirePermission ──
    const requiredPermission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredPermission) {
      if (!role) throw new ForbiddenException('غير مصادق.');
      if (!hasPermission(role, requiredPermission, livePermissions)) {
        throw new ForbiddenException(`تحتاج صلاحية: ${requiredPermission}`);
      }
      return true;
    }

    // ── فحص @RequireAnyPermission ──
    const requiredAny = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_ANY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredAny?.length) {
      if (!role) throw new ForbiddenException('غير مصادق.');
      const ok = requiredAny.some((p) => hasPermission(role, p, livePermissions));
      if (!ok) {
        throw new ForbiddenException(`تحتاج إحدى الصلاحيات: ${requiredAny.join(' أو ')}`);
      }
      return true;
    }

    // ── فحص @Roles ──
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;
    if (!role) throw new ForbiddenException('غير مصادق.');

    const allowed = requiredRoles.some((r) => role === (r || '').toLowerCase());
    if (!allowed) {
      throw new ForbiddenException('ليس لديك دور كافٍ للوصول لهذا المورد.');
    }
    return true;
  }
}
