import {
  IsString, IsOptional, IsNumber, IsDateString, IsIn, Min, MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateEmployeeDto {
  @IsOptional() @IsString() @MaxLength(120) name?:               string;
  @IsOptional() @IsString()                 nameEn?:             string;
  @IsOptional() @IsString() @MaxLength(20)  iqamaNumber?:        string;
  @IsOptional() @IsString() @MaxLength(80)  jobTitle?:           string;
  @IsOptional() @IsNumber() @Min(0) @Transform(({ value }) => Number(value)) basicSalary?:        number;
  @IsOptional() @IsNumber() @Min(0) @Transform(({ value }) => Number(value)) housingAllowance?:   number;
  @IsOptional() @IsNumber() @Min(0) @Transform(({ value }) => Number(value)) transportAllowance?: number;
  @IsOptional() @IsNumber() @Min(0) @Transform(({ value }) => Number(value)) otherAllowance?: number;
  @IsOptional() @IsString() @MaxLength(80)  workHours?:          string;
  @IsOptional() @IsString() @MaxLength(120) workSchedule?:       string;
  @IsOptional() @IsDateString()             joinDate?:           string;
  @IsOptional() @IsIn(['active','terminated','on_leave','archived']) status?: string;
  @IsOptional() @IsString()                 notes?:              string;
}
