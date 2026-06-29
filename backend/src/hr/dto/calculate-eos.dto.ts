import { IsDateString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EOS_REASON_OPTIONS, type EosReason } from '@noorix/finance-core';

export class CalculateEosDto {
  @IsDateString()
  joinDate: string;

  @IsDateString()
  endDate: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  wage: number;

  @IsIn(EOS_REASON_OPTIONS)
  reason: EosReason;
}

