import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getCompanyIdFromHttpRequest } from '../../common/utils/company-request';

/**
 * companyId — يطابق ترتيب CompanyAccessGuard (body/params/query/header).
 */
export const CompanyId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return getCompanyIdFromHttpRequest(ctx.switchToHttp().getRequest());
  },
);
