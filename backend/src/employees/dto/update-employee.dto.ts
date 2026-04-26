import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeDto } from './create-employee.dto';

/**
 * تعديل موظف — كل الحقول اختيارية؛ companyId ليس جزءاً من جسم التعديل.
 */
export class UpdateEmployeeDto extends PartialType(
  OmitType(CreateEmployeeDto, ['companyId'] as const),
) {}
