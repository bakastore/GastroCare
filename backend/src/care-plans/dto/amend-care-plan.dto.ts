import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class AmendCarePlanDto {
  @IsString()
  @MinLength(1)
  instructions!: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}
