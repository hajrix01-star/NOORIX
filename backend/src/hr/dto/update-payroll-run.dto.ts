import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsIn,
  IsArray,
  IsDateString,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { PayrollRunItemDto, PayrollRunVaultSplitDto } from './create-payroll-run.dto';

export class UpdatePayrollRunDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;

  @IsOptional()
  @IsDateString()
  payrollMonth?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollRunItemDto)
  items?: PayrollRunItemDto[];

  /** عند إرساله مع `items` يُحدَّث توزيع الخزائن للمسيرة؛ مصفوفة فارغة = حذف التوزيع */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollRunVaultSplitDto)
  vaultSplits?: PayrollRunVaultSplitDto[];
}

export class UpdatePayrollRunStatusDto {
  @IsString()
  @IsIn(['draft', 'completed'])
  status: string;
}
