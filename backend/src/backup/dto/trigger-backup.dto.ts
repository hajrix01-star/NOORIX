import { IsIn, IsString } from 'class-validator';

export class TriggerBackupDto {
  @IsIn(['company'])
  scope!: 'company';

  @IsString()
  companyId!: string;
}
