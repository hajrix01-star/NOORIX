import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateResidencyDto } from './create-residency.dto';

/**
 * تعديل إقامة — companyId/employeeId يُستخرجان من URL السياق وليس تعديلاً مباشراً هنا.
 */
export class UpdateResidencyDto extends PartialType(
  OmitType(CreateResidencyDto, ['companyId', 'employeeId'] as const),
) {}
