import {
  IsString, IsNumber, IsInt, IsArray, IsOptional,
  ValidateNested, Min, Max, IsDateString, ArrayMinSize, Matches, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SalesChannelDto {
  @IsString()
  vaultId: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, { message: 'المبلغ يجب أن يكون رقماً موجباً بحد أقصى خانتين عشريتين' })
  amount: string;
}

export class CreateSalesSummaryDto {
  @IsString()
  companyId: string;

  @IsDateString()
  transactionDate: string;

  @IsInt({ message: 'عدد العملاء يجب أن يكون عدداً صحيحاً' })
  @Min(0)
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

  /** مفتاح عدم التكرار — يمنع تنفيذ نفس العملية مرتين (مثلاً عند النقر المزدوج) */
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
