import { PartialType } from '@nestjs/mapped-types';
import { CreatePurchaseDebtDto } from './create-purchase-debt.dto';

export class UpdatePurchaseDebtDto extends PartialType(CreatePurchaseDebtDto) {}
