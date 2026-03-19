import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * استخدم فوق الـ controller أو الـ handler لتقييد الوصول بدور معين.
 * مثال: @Roles('super_admin', 'owner')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
