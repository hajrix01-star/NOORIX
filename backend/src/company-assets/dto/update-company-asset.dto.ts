import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateCompanyAssetDto } from './create-company-asset.dto';

/** تعديل أصل — كل الحقول اختيارية؛ companyId ليس جزءاً من جسم التعديل. */
export class UpdateCompanyAssetDto extends PartialType(
  OmitType(CreateCompanyAssetDto, ['companyId'] as const),
) {}
