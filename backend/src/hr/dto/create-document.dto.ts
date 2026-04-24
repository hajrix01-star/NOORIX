import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const DOCUMENT_TYPES = ['contract', 'certificate', 'iqama', 'other'] as const;

export class CreateDocumentDto {
  @IsString()
  companyId: string;

  @IsString()
  employeeId: string;

  @IsString()
  @IsIn(DOCUMENT_TYPES)
  documentType: (typeof DOCUMENT_TYPES)[number];

  @IsString()
  fileName: string;

  @IsOptional()
  @IsString()
  filePath?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  fileSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;
}
