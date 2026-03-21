import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../constants/permissions';

export const PERMISSIONS_ANY_KEY = 'required_permissions_any';

/** يكفي أن يملك المستخدم إحدى الصلاحيات المذكورة */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
