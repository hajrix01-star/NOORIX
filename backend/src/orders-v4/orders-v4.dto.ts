import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { OrdersV4CancellationReason } from './orders-v4.contracts';
import { ORDERS_V4_CANCELLATION_REASONS } from './orders-v4-registration-cancellation.policy';

const NON_NEGATIVE_DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const POSITIVE_DECIMAL = /^(?:(?:0\.(?:0*?[1-9]\d*))|(?:[1-9]\d*(?:\.\d+)?))$/;
const DATE = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/;

export class OrdersV4NamedDto {
  @IsString() @MaxLength(160) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(160) nameEn?: string | null;
  @IsOptional() @IsString() @MaxLength(80) code?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) sortOrder?: number;
}

export class OrdersV4LocationDto extends OrdersV4NamedDto {
  @IsOptional() @IsString() @MaxLength(40) kind?: string;
  @IsOptional() @IsString() sectionId?: string | null;
}

export class OrdersV4UnitDto {
  @IsString() @MaxLength(80) code!: string;
  @IsString() @MaxLength(160) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(160) nameEn?: string | null;
  @IsString() @IsIn(['count', 'mass', 'volume', 'package']) dimension!: string;
  @IsOptional() @IsString() @Matches(POSITIVE_DECIMAL) canonicalFactor?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(12) decimalScale?: number;
}

export class OrdersV4ItemUnitDto {
  @IsString() unitId!: string;
  @IsOptional() @IsString() @MaxLength(160) purchaseLabel?: string | null;
  @IsOptional() @IsBoolean() isOrderEnabled?: boolean;
  @IsOptional() @IsString() @Matches(NON_NEGATIVE_DECIMAL) lastPrice?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) sortOrder?: number;
}

export class OrdersV4ItemDto {
  @IsOptional() @IsString() @MaxLength(100) sku?: string | null;
  @IsString() @MaxLength(200) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string | null;
  @IsIn(['purchased', 'sale']) itemType!: 'purchased' | 'sale';
  @IsOptional() @IsString() categoryId?: string | null;
  @IsString() inventoryUnitId!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) sectionIds?: string[];
  @IsOptional() @IsBoolean() trackInventory?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) sortOrder?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OrdersV4ItemUnitDto)
  units?: OrdersV4ItemUnitDto[];
}

export class OrdersV4ItemUpdateDto {
  @IsOptional() @IsString() @MaxLength(100) sku?: string | null;
  @IsString() @MaxLength(200) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string | null;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) sectionIds?: string[];
  @IsOptional() @IsBoolean() trackInventory?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) sortOrder?: number;
}

export class OrdersV4ConversionEdgeDto {
  @IsString() fromUnitId!: string;
  @IsString() toUnitId!: string;
  @IsString() @Matches(POSITIVE_DECIMAL) factor!: string;
  @IsOptional() @IsBoolean() reversible?: boolean;
  @IsOptional() @IsBoolean() allowDimensionBridge?: boolean;
}

export class OrdersV4ItemDefinitionDto {
  @IsString() inventoryUnitId!: string;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OrdersV4ConversionEdgeDto)
  edges!: OrdersV4ConversionEdgeDto[];
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OrdersV4ItemUnitDto)
  units!: OrdersV4ItemUnitDto[];
}

export class OrdersV4RecipeLineDto {
  @IsString() componentItemId!: string;
  @IsString() @Matches(POSITIVE_DECIMAL) quantity!: string;
  @IsString() unitId!: string;
}

export class OrdersV4RecipePublishDto {
  @IsString() outputItemId!: string;
  @IsString() @Matches(POSITIVE_DECIMAL) outputQuantity!: string;
  @IsString() outputUnitId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(250) @ValidateNested({ each: true }) @Type(() => OrdersV4RecipeLineDto)
  lines!: OrdersV4RecipeLineDto[];
}

export class OrdersV4DocumentLineDto {
  @IsString() itemId!: string;
  @IsString() @Matches(POSITIVE_DECIMAL) quantity!: string;
  @IsString() unitId!: string;
  @IsOptional() @IsString() @Matches(NON_NEGATIVE_DECIMAL) unitPrice?: string;
  @IsOptional() @IsString() priceUnitId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(ORDERS_V4_CANCELLATION_REASONS.length)
  @IsIn([...ORDERS_V4_CANCELLATION_REASONS], { each: true })
  cancellationReasons?: OrdersV4CancellationReason[] | null;
  @IsOptional() @IsString() @MaxLength(1000) cancellationNote?: string | null;
}

export class OrdersV4DocumentDto {
  @IsIn(['purchase', 'registration']) documentType!: 'purchase' | 'registration';
  @IsOptional() @IsIn(['issue', 'cancellation']) registrationEntryType?: 'issue' | 'cancellation';
  @IsString() @Matches(DATE) documentDate!: string;
  @IsOptional() @IsIn(['custody', 'cash', 'transfer']) paymentMethod?: 'custody' | 'cash' | 'transfer' | null;
  @IsOptional() @IsString() sectionId?: string | null;
  @IsString() locationId!: string;
  @IsOptional() @IsString() @Matches(NON_NEGATIVE_DECIMAL) pettyCashAmount?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
  @IsString() @MaxLength(200) idempotencyKey!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => OrdersV4DocumentLineDto)
  lines!: OrdersV4DocumentLineDto[];
}

export class OrdersV4DocumentPreviewDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => OrdersV4DocumentLineDto)
  lines!: OrdersV4DocumentLineDto[];
}

export class OrdersV4ReceiveDto {
  @IsOptional() @IsIn(['standard', 'correction']) editMode?: 'standard' | 'correction';
  @IsOptional() @IsIn(['issue', 'cancellation']) registrationEntryType?: 'issue' | 'cancellation';
  @IsString() @Matches(DATE) documentDate!: string;
  @IsOptional() @IsIn(['custody', 'cash', 'transfer']) paymentMethod?: 'custody' | 'cash' | 'transfer' | null;
  @IsOptional() @IsString() sectionId?: string | null;
  @IsString() locationId!: string;
  @IsOptional() @IsString() @Matches(NON_NEGATIVE_DECIMAL) pettyCashAmount?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
  @IsString() @MaxLength(200) idempotencyKey!: string;
  @Type(() => Number) @IsInt() @Min(1) revision!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => OrdersV4DocumentLineDto)
  lines!: OrdersV4DocumentLineDto[];
}

export class OrdersV4StocktakeUnitDto {
  @IsString() unitId!: string;
  @IsString() @Matches(NON_NEGATIVE_DECIMAL) quantity!: string;
}

export class OrdersV4StocktakeLineDto {
  @IsString() itemId!: string;
  @IsOptional() @IsString() @Matches(NON_NEGATIVE_DECIMAL) physicalQuantity?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => OrdersV4StocktakeUnitDto)
  physicalUnits?: OrdersV4StocktakeUnitDto[];
}

export class OrdersV4StocktakeDto {
  @IsString() @Matches(DATE) stocktakeDate!: string;
  @IsString() locationId!: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsString() @MaxLength(200) idempotencyKey!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => OrdersV4StocktakeLineDto)
  lines!: OrdersV4StocktakeLineDto[];
}

export class OrdersV4IdempotencyDto {
  @IsString() @MaxLength(200) idempotencyKey!: string;
}

/**
 * Company context is transported as a query parameter by the shared frontend
 * client and consumed by CompanyAccessGuard/@CompanyId. Query DTOs must still
 * declare it because the global ValidationPipe rejects undeclared properties.
 */
export abstract class OrdersV4CompanyQueryDto {
  @IsOptional() @IsString() companyId?: string;
}

export class OrdersV4DateRangeQueryDto extends OrdersV4CompanyQueryDto {
  @IsOptional() @IsString() @Matches(DATE) startDate?: string;
  @IsOptional() @IsString() @Matches(DATE) endDate?: string;
}

export class OrdersV4DocumentsQueryDto extends OrdersV4DateRangeQueryDto {
  @IsOptional() @IsIn(['purchase', 'registration']) type?: 'purchase' | 'registration';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) limit?: number;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() sectionId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() itemId?: string;
  @IsOptional() @IsIn(['custody', 'cash', 'transfer']) paymentMethod?: 'custody' | 'cash' | 'transfer';
  @IsOptional() @IsIn(['prepared', 'received', 'cancelled', 'reversed']) status?: 'prepared' | 'received' | 'cancelled' | 'reversed';
}

export class OrdersV4ItemsReportQueryDto extends OrdersV4DateRangeQueryDto {
  @IsOptional() @IsIn(['purchase', 'registration']) type?: 'purchase' | 'registration';
}

export class OrdersV4ActivityReportQueryDto extends OrdersV4DateRangeQueryDto {
  @IsOptional() @IsIn(['purchase', 'registration']) type?: 'purchase' | 'registration';
  @IsOptional() @IsString() @MaxLength(5000) sectionIds?: string;
  @IsOptional() @IsString() @MaxLength(5000) categoryIds?: string;
  @IsOptional() @IsString() @MaxLength(5000) itemIds?: string;
  @IsOptional() @IsString() @MaxLength(5000) baseUnitIds?: string;
  @IsOptional() @IsString() @MaxLength(5000) inputUnitIds?: string;
  @IsOptional() @IsString() @MaxLength(500) paymentMethods?: string;
  @IsOptional() @IsString() @MaxLength(500) statuses?: string;
  @IsOptional() @IsString() @MaxLength(500) registrationEntryTypes?: string;
  @IsOptional() @IsString() @MaxLength(1000) cancellationReasons?: string;
  @IsOptional() @IsString() @MaxLength(5000) createdByUserIds?: string;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}

export class OrdersV4LedgerQueryDto extends OrdersV4CompanyQueryDto {
  @IsOptional() @IsString() itemId?: string;
  @IsOptional() @IsString() locationId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}

export class OrdersV4LimitQueryDto extends OrdersV4CompanyQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}
