import { IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceVaultSplitDto {
  @IsString()
  vaultId: string;

  @IsNumber()
  @Min(0.01, { message: 'كل جزء من توزيع الخزائن يجب أن يكون أكبر من صفر' })
  @Max(10_000_000, { message: 'جزء الخزنة يتجاوز الحد المسموح' })
  @Type(() => Number)
  amount: number;
}
