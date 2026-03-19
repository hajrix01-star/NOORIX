/**
 * @CurrentUser() — يسحب بيانات المستخدم المصادق عليه من JWT مباشرة.
 * يُستخدم في Controllers لتمرير userId للـ Services بدلاً من null.
 *
 * @example
 * @Post()
 * async create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: JwtUser) {
 *   return this.invoiceService.createWithLedger(dto, user.sub);
 * }
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  sub:        string;       // userId
  email:      string;
  role:       string;
  tenantId:   string;
  companyIds: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtUser;
  },
);
