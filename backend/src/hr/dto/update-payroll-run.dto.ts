import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpdatePayrollRunDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayrollRunStatusDto {
  @IsString()
  @IsIn(['draft', 'completed'])
  status: string;
}
