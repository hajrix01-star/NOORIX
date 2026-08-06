import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { CreatePurchaseDebtDto } from './create-purchase-debt.dto';

export class CreatePurchaseDebtBatchDto {
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseDebtDto)
  items: CreatePurchaseDebtDto[];
}
