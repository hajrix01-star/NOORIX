import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PayrollLegacyCorrectionPreviewDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  targetMonth!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  sourceRunNumber!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  ledgerEntryIds!: string[];
}

export class PayrollLegacyCorrectionConfirmDto extends PayrollLegacyCorrectionPreviewDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  previewHash!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  idempotencyKey!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;

  @IsString()
  @IsIn(['CANCEL_CONFIRMED_PAYROLL_DUPLICATES'])
  confirmation!: 'CANCEL_CONFIRMED_PAYROLL_DUPLICATES';
}
