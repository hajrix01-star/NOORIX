import React from 'react';
import { useLocation } from 'react-router-dom';
import { hasPermission, ROUTE_PERMISSION, REDIRECT_ONLY_PATHS } from '../constants/permissions';
import Forbidden403 from './Forbidden403';

/**
 * يلف المحتوى ويمنع العرض إذا كان المستخدم لا يملك صلاحية المسار الحالي.
 * المسارات التي تُعيد التوجيه فقط تمر بدون فحص.
 */
export default function PermissionGuard({ children, userRole, isUserLoading }) {
  const location = useLocation();
  const path = location.pathname;

  // بينما المستخدم يُحمَّل — ننتظر
  if (isUserLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', color: 'var(--noorix-text-muted)', fontSize: 14 }}>
        جاري التحقق...
      </div>
    );
  }

  // مسارات إعادة التوجيه والصفحات العامة — لا تحتاج فحص صلاحية
  if (REDIRECT_ONLY_PATHS.has(path)) return children;

  // مسار غير مدرج أصلاً — اسمح بالمرور (سيُعيد التوجيه لـ *)
  const requiredPermission = ROUTE_PERMISSION[path];
  if (!requiredPermission) return children;

  const allowed = hasPermission(userRole, requiredPermission);
  if (!allowed) return <Forbidden403 />;
  return children;
}
