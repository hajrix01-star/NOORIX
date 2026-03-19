import { SetMetadata } from '@nestjs/common';

export const REQUIRE_COMPANY_ACCESS_KEY = 'requireCompanyAccess';

/**
 * تفعيل فحص الوصول للشركة على هذا الـ handler (يستخدم مع CompanyAccessGuard).
 */
export const RequireCompanyAccess = () => SetMetadata(REQUIRE_COMPANY_ACCESS_KEY, true);
