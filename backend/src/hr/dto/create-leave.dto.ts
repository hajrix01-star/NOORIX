import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

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

/** تحديث جزئي لإجازة — يُرسل حقل واحد أو أكثر */
export class UpdateLeaveDto {
  @IsOptional()
  @IsString()
  @IsIn(LEAVE_TYPES)
  leaveType?: (typeof LEAVE_TYPES)[number];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

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
  notes?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  /**
   * عند وجود تسوية راتب مُصرفة: إلزامي لأي تعديل يغيّر بيانات الإجازة الجوهرية
   * (النوع، التواريخ، العدد، الحالة، الموظف). يُلغي فاتورة الراتب وعكس القيود ثم يحذف سجل التسوية.
   */
  @IsOptional()
  @IsBoolean()
  voidSalarySettlement?: boolean;
}
