import { IsString, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateEmployeeDto } from './create-employee.dto';

export class CreateBatchEmployeesDto {
  @IsString()
  companyId: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'يجب إدخال موظف واحد على الأقل' })
  @ValidateNested({ each: true })
  @Type(() => CreateEmployeeDto)
  items: (CreateEmployeeDto & { companyId?: string })[];
}
