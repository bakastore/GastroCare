import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateDraftCarePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  instructions?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
