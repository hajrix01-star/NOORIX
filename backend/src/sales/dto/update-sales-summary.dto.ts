import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateSalesSummaryDto, SalesChannelDto } from './create-sales-summary.dto';

/**
 * تعديل ملخّص مبيعات يومي — كل الحقول اختياريّة.
 * `companyId` / `idempotencyKey` من Create لا يُمرَّان في PATCH.
 * القنوات تستخدم نفس `SalesChannelDto` (مطابقة مبلغ القناة) كما في الإنشاء.
 */
export class UpdateSalesSummaryDto extends PartialType(
  OmitType(CreateSalesSummaryDto, ['companyId', 'idempotencyKey'] as const),
) {}

export { SalesChannelDto };
