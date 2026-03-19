import { SetMetadata } from '@nestjs/common';

/**
 * تجاوز فحص CompanyAccessGuard لـ endpoints معينة.
 * استخدم فقط على endpoints "عامة" داخل مسارات محمية بـ JWT
 * (مثال: GET /companies لا يحتاج companyId لأن المستخدم يرى شركاته فقط).
 */
export const SKIP_COMPANY_CHECK_KEY = 'skip_company_check';
export const SkipCompanyCheck = () => SetMetadata(SKIP_COMPANY_CHECK_KEY, true);
