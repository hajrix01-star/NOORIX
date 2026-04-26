import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IntersectionType, OmitType, PartialType } from '@nestjs/mapped-types';

const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'other'] as const;

export class CreateLeaveDto {
  @IsString()
  companyId: string;

  @IsString()
  employeeId: string;

  @IsString()
  @IsIn(LEAVE_TYPES)
  leaveType: (typeof LEAVE_TYPES)[number];

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  daysCount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'الملاحظة يجب ألا تتجاوز 2000 حرف' })
  notes?: string;
}

export class UpdateLeaveStatusDto {
  @IsString()
  @IsIn(['pending', 'approved', 'rejected'])
  status: string;

  /** عند رفض إجازة معتمدة وصُرفت لها تسوية راتب — يُلغى الصرف والفاتورة أولاً */
  @IsOptional()
  @IsBoolean()
  voidSalarySettlement?: boolean;
}

class UpdateLeaveVoidSettlementField {
  /**
   * عند وجود تسوية راتب مُصرفة: إلزامي لأي تعديل يغيّر بيانات الإجازة الجوهرية
   * (النوع، التواريخ، العدد، الحالة، الموظف). يُلغي فاتورة الراتب وعكس القيود ثم يحذف سجل التسوية.
   */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  voidSalarySettlement?: boolean;
}

/** تحديث جزئي لإجازة — يُرسل حقل واحد أو أكثر؛ companyId ليس في جسم التعديل. */
export class UpdateLeaveDto extends IntersectionType(
  PartialType(OmitType(CreateLeaveDto, ['companyId'] as const)),
  UpdateLeaveVoidSettlementField,
) {}
