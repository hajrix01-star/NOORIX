import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsIn,
  Min,
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
}
