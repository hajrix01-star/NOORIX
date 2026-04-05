import React from 'react';
import { useLocation } from 'react-router-dom';
import { getRouteRequiredPermissions, isSuperAdmin, hasPermission } from '../constants/permissions';
import Forbidden403 from './Forbidden403';

/**
 * حارس صلاحيات على مستوى المسارات (client-side).
 *
 * ⚠️  أمان: هذا الحارس يمنع العرض فقط — الحماية الحقيقية على الـ API (backend).
 *     يجب ألّا تعتمد على هذا الحارس وحده لمنع وصول البيانات الحساسة.
 *
 * مصدر الصلاحيات: يجب أن تأتي userPermissions و userRole من JWT المُفكَّك
 *     على الـ backend أو من /me endpoint موثوق — لا من localStorage مباشرة.
 *
 * يعرض <Forbidden403 /> عند انعدام الصلاحية بدلاً من null لإبلاغ المستخدم.
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

  const allowed = requiredList.some((perm) => hasPermission(userRole, perm, userPermissions));
  if (!allowed) return <Forbidden403 />;
  return children;
}
