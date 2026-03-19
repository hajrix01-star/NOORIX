import { SetMetadata }   from '@nestjs/common';
import type { Permission } from '../constants/permissions';

export const PERMISSION_KEY = 'required_permission';

/**
 * يُقيّد الـ endpoint بصلاحية محددة.
 * يُستخدم مع RolesGuard لفحص دقيق على مستوى الصلاحية.
 *
 * @example
 * @RequirePermission('VAULTS_DELETE')
 * async remove(...) { ... }
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
