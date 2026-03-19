import React from 'react';
import { useLocation } from 'react-router-dom';
import { getRouteRequiredPermissions, isSuperAdmin } from '../constants/permissions';
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

  const requiredList = getRouteRequiredPermissions(path);
  if (!requiredList?.length) return children;

  if (isSuperAdmin(userRole)) return children;

  const allowed =
    Array.isArray(userPermissions) &&
    requiredList.some((perm) => userPermissions.includes(perm));
  if (!allowed) return <Forbidden403 />;
  return children;
}
