/**
 * RolesGuard — يفرض الأدوار والصلاحيات على الـ Endpoints.
 *
 * يدعم نمطين:
 *   @Roles('owner', 'super_admin')      → فحص الدور مباشرة
 *   @RequirePermission('INVOICES_WRITE') → فحص الصلاحية (أدق وأوسع)
 *
 * الأولوية: إذا لم يُطبَّق أي decorator → العبور (للمسارات العامة).
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector }           from '@nestjs/core';
import { ROLES_KEY }           from '../decorators/roles.decorator';
import { PERMISSION_KEY }      from '../decorators/require-permission.decorator';
import { hasPermission, isSuperAdmin } from '../constants/permissions';
import type { Permission }     from '../constants/permissions';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const role      = (user?.role || '').toLowerCase();

    // ── فحص الصلاحية (Permission) ─────────────────────────
    const requiredPermission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredPermission) {
      if (!role) throw new ForbiddenException('غير مصادق.');
      if (!hasPermission(role, requiredPermission)) {
        throw new ForbiddenException(`تحتاج صلاحية: ${requiredPermission}`);
      }
      return true;
    }

    // ── فحص الدور (Role) ──────────────────────────────────
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true; // لا قيود → مفتوح للجميع

    if (!role) throw new ForbiddenException('غير مصادق.');

    const allowed = requiredRoles.some(
      (r) => role === (r || '').toLowerCase(),
    );
    if (!allowed) {
      throw new ForbiddenException('ليس لديك دور كافٍ للوصول لهذا المورد.');
    }
    return true;
  }
}
