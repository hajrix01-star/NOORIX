import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { CreateResidencyDto } from './create-residency.dto';

export class ResidencyIssueInvoiceInlineDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  vaultId: string;
}

export class CreateResidencyWithInvoiceDto extends CreateResidencyDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ResidencyIssueInvoiceInlineDto)
  issueInvoice?: ResidencyIssueInvoiceInlineDto;
}
