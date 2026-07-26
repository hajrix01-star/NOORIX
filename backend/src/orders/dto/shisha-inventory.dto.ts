import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const NON_NEGATIVE_DECIMAL = /^\d+(\.\d{1,6})?$/;
const POSITIVE_DECIMAL = /^(?!0+(?:\.0+)?$)\d+(\.\d{1,6})?$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

export class InitializeShishaInventoryDto {
  @IsString()
  @Matches(YMD)
  startDate: string;

  @IsString()
  @Matches(POSITIVE_DECIMAL)
  headsPerKg: string;

  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  tobaccoQuantity: string;

  @IsIn(['kg', 'g'])
  tobaccoUnit: 'kg' | 'g';

  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  hoses: string;

  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  charcoalCartons: string;

  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  charcoalPacks: string;

  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  charcoalPieces: string;

  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  tobaccoCostInclVat?: string;

  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  hoseCostInclVat?: string;

  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  charcoalCostInclVat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateShishaPurchaseDto {
  @IsString()
  @Matches(YMD)
  transactionDate: string;

  @IsIn(['tobacco', 'hose', 'charcoal'])
  materialType: 'tobacco' | 'hose' | 'charcoal';

  @IsString()
  @Matches(POSITIVE_DECIMAL)
  quantity: string;

  @IsIn(['kg', 'g', 'piece', 'pack', 'carton'])
  unit: 'kg' | 'g' | 'piece' | 'pack' | 'carton';

  @IsOptional()
  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  costInclVat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  supplierName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateShishaStocktakeDto {
  @IsString()
  @Matches(YMD)
  stocktakeDate: string;

  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  tobaccoQuantity: string;

  @IsIn(['kg', 'g'])
  tobaccoUnit: 'kg' | 'g';

  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  hoses: string;

  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  charcoalCartons: string;

  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  charcoalPacks: string;

  @IsString()
  @Matches(NON_NEGATIVE_DECIMAL)
  charcoalPieces: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
