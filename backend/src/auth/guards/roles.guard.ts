/**
 * RolesGuard — يفرض الأدوار والصلاحيات على الـ Endpoints.
 * يدعم: @Roles('owner'), @RequirePermission('INVOICES_WRITE')
 * يقرأ الصلاحيات من JWT payload (permissions[]) — يدعم الأدوار المخصصة.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector }           from '@nestjs/core';
import { ROLES_KEY }           from '../decorators/roles.decorator';
import { PERMISSION_KEY }      from '../decorators/require-permission.decorator';
import { PERMISSIONS_ANY_KEY } from '../decorators/require-any-permission.decorator';
import { hasPermission } from '../constants/permissions';
import type { Permission }     from '../constants/permissions';

interface RequestUser {
  role?: string;
  permissions?: string[];
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const role = (user?.role || '').toLowerCase();
    const userPermissions = user?.permissions || [];

    const requiredPermission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredPermission) {
      if (!role) throw new ForbiddenException('غير مصادق.');
      if (!hasPermission(role, requiredPermission, userPermissions)) {
        throw new ForbiddenException(`تحتاج صلاحية: ${requiredPermission}`);
      }
      return true;
    }

    const requiredAny = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_ANY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredAny?.length) {
      if (!role) throw new ForbiddenException('غير مصادق.');
      const ok = requiredAny.some((p) => hasPermission(role, p, userPermissions));
      if (!ok) {
        throw new ForbiddenException(`تحتاج إحدى الصلاحيات: ${requiredAny.join(' أو ')}`);
      }
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

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
