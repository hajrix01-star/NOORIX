import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitOcrImageDto {
  @IsString()
  imageBase64!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  mimeType?: string;
}

export class SubmitOcrBatchEntryDto {
  /** single = each image is its own invoice; multi_page = merge images into one invoice */
  @IsIn(['single', 'multi_page'])
  layout!: 'single' | 'multi_page';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => SubmitOcrImageDto)
  images!: SubmitOcrImageDto[];
}

export class SubmitOcrBatchDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SubmitOcrBatchEntryDto)
  entries!: SubmitOcrBatchEntryDto[];
}
