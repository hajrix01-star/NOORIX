import { IsString, MinLength } from 'class-validator';

export class RestoreFullBackupDto {
  @IsString()
  @MinLength(1)
  confirmPhrase!: string;
}
