import { Transform, Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * GET /api/v1/owner/overview
 * يجمع P&L + مبيعات يومية لعدة شركات في طلب واحد.
 */
export class OwnerOverviewQueryDto {
  /** معرّفات الشركات — يمكن تمريرها كقيمة مكررة: ?companyIds=A&companyIds=B */
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]).filter(Boolean))
  companyIds: string[];

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  /** الشهر المطلوب للمبيعات اليومية (1–12) — اختياري */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}
