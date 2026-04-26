import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateExpenseLineDto } from './create-expense-line.dto';

/** تعديل بند مصروف/ثابت — كل الحقول اختيارية؛ companyId ليس في جسم التعديل. */
export class UpdateExpenseLineDto extends PartialType(
  OmitType(CreateExpenseLineDto, ['companyId'] as const),
) {}
