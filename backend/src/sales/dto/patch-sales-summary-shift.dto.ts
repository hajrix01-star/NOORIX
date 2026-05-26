import { IsIn, IsString } from 'class-validator';
import { SALES_SHIFT_VALUES } from './create-sales-summary.dto';

export class PatchSalesSummaryShiftDto {
  @IsString()
  @IsIn(SALES_SHIFT_VALUES, { message: 'الشفت يجب أن يكون: يوم كامل (all) أو صباحي (morning) أو مسائي (evening)' })
  shift: (typeof SALES_SHIFT_VALUES)[number];
}
