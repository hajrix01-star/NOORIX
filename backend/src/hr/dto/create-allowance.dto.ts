import {
  IsString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAllowanceDto {
  @IsString()
  companyId: string;

  @IsString()
  employeeId: string;

  @IsString()
  nameAr: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;
}
