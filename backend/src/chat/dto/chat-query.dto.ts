import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChatQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  query!: string;
}
