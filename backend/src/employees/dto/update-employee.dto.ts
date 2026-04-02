import {
  IsString, IsOptional, IsNumber, IsDateString, IsIn, Min, Max, MaxLength, Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateEmployeeDto {
  @IsOptional() @IsString() @MaxLength(120) name?:               string;
  @IsOptional() @IsString()                 nameEn?:             string;
  @IsOptional() @IsString() @Matches(/^\d{10}$/, { message: 'رقم الهوية/الإقامة يجب أن يكون 10 أرقام بالضبط' }) iqamaNumber?: string;
  @IsOptional() @IsString() @MaxLength(80)  jobTitle?:           string;
  @IsOptional() @IsNumber() @Min(0) @Max(500_000, { message: 'الراتب الأساسي لا يمكن أن يتجاوز 500,000' }) @Transform(({ value }) => Number(value)) basicSalary?:        number;
  @IsOptional() @IsNumber() @Min(0) @Max(300_000, { message: 'بدل السكن لا يمكن أن يتجاوز 300,000' })       @Transform(({ value }) => Number(value)) housingAllowance?:   number;
  @IsOptional() @IsNumber() @Min(0) @Max(50_000,  { message: 'بدل المواصلات لا يمكن أن يتجاوز 50,000' })   @Transform(({ value }) => Number(value)) transportAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(200_000, { message: 'البدلات الأخرى لا يمكن أن تتجاوز 200,000' }) @Transform(({ value }) => Number(value)) otherAllowance?:     number;
  @IsOptional() @IsString() @MaxLength(80)  workHours?:          string;
  @IsOptional() @IsString() @MaxLength(120) workSchedule?:       string;
  @IsOptional() @IsDateString()             joinDate?:           string;
  @IsOptional() @IsIn(['active','terminated','on_leave','archived']) status?: string;
  @IsOptional() @IsString()                 notes?:              string;
}
