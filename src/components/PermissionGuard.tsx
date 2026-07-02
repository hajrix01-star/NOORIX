import React, { type ReactNode } from 'react';
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
type PermissionGuardProps = {
  children: ReactNode;
  userRole?: string;
  userPermissions?: string[];
  isUserLoading?: boolean;
};

export default function PermissionGuard({
  children,
  userRole,
  userPermissions,
  isUserLoading,
}: PermissionGuardProps) {
  const location = useLocation();
  const path = location.pathname;

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[14px] text-noorix-muted">
        جاري التحقق...
      </div>
    );
  }

  const requiredList = getRouteRequiredPermissions(path);
  if (!requiredList?.length) return children;

  if (isSuperAdmin(userRole)) return children;

  const allowed = requiredList.some((perm: any) => hasPermission(userRole, perm, userPermissions));
  if (!allowed) return <Forbidden403 />;
  return children;
}
