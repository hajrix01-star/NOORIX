import {
  IsString, IsInt, IsArray, IsOptional,
  ValidateNested, Min, Max, IsDateString, ArrayMinSize, ArrayMaxSize,
  Matches, MaxLength, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SALES_SHIFT_VALUES, SalesChannelDto } from './create-sales-summary.dto';

export class CreateSalesSummaryBatchItemDto {
  @IsString()
  @IsIn(SALES_SHIFT_VALUES, { message: 'الشفت يجب أن يكون: يوم كامل (all) أو صباحي (morning) أو مسائي (evening)' })
  shift: (typeof SALES_SHIFT_VALUES)[number];

  @IsInt({ message: 'عدد العملاء يجب أن يكون عدداً صحيحاً' })
  @Min(1, { message: 'عدد العملاء يجب أن يكون 1 على الأقل' })
  @Max(100_000, { message: 'عدد العملاء لا يمكن أن يتجاوز 100,000' })
  @Type(() => Number)
  customerCount: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'النقد في الصندوق يجب أن يكون رقماً موجباً بحد أقصى خانتين عشريتين' })
  cashOnHand?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'يجب إدخال قناة بيع واحدة على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => SalesChannelDto)
  channels: SalesChannelDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;
}

export class CreateSalesSummaryBatchDto {
  @IsString()
  companyId: string;

  @IsDateString()
  transactionDate: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'يجب إدخال ملخص واحد على الأقل' })
  @ArrayMaxSize(2, { message: 'لا يمكن إدخال أكثر من ملخصين في عملية واحدة' })
  @ValidateNested({ each: true })
  @Type(() => CreateSalesSummaryBatchItemDto)
  items: CreateSalesSummaryBatchItemDto[];

  @IsOptional()
  @IsString()
  batchIdempotencyKey?: string;
}
