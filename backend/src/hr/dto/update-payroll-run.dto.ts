import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsIn, IsString } from 'class-validator';
import { CreatePayrollRunDto } from './create-payroll-run.dto';

/**
 * تعديل مسيرة رواتب — كل الحقول اختيارية؛ companyId ليس جزءاً من جسم التعديل.
 * (عند إرسال items مع vaultSplits يُحدَّث التوزيع؛ مصفوفة vaultSplits فارغة = حذف التوزيع — سلوك الخادم)
 */
export class UpdatePayrollRunDto extends PartialType(
  OmitType(CreatePayrollRunDto, ['companyId'] as const),
) {}

export class UpdatePayrollRunStatusDto {
  @IsString()
  @IsIn(['draft', 'completed'])
  status: string;
}
