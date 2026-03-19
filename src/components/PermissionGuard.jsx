import React from 'react';
import { useLocation } from 'react-router-dom';
import { hasPermission, ROUTE_PERMISSION, REDIRECT_ONLY_PATHS, isSuperAdmin } from '../constants/permissions';
import Forbidden403 from './Forbidden403';

/**
 * يلف المحتوى ويمنع العرض إذا كان المستخدم لا يملك صلاحية المسار الحالي.
 * يستخدم permissions من قاعدة البيانات (عبر user object) بدلاً من الخريطة الثابتة.
 */
export default function PermissionGuard({ children, userRole, userPermissions, isUserLoading }) {
  const location = useLocation();
  const path = location.pathname;

  if (isUserLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--noorix-text-muted)', fontSize: 14 }}>
        جاري التحقق...
      </div>
    );
  }

  if (REDIRECT_ONLY_PATHS.has(path)) return children;

  const requiredPermission = ROUTE_PERMISSION[path];
  if (!requiredPermission) return children;

  if (isSuperAdmin(userRole)) return children;

  const allowed = Array.isArray(userPermissions) && userPermissions.includes(requiredPermission);
  if (!allowed) return <Forbidden403 />;
  return children;
}
