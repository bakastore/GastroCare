import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EmploymentType } from '@prisma/client';

export class CreateEmploymentDto {
  @IsString()
  @MaxLength(200)
  organizationName: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  department?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  positionTitle?: string | null;

  @IsString()
  startDate: string;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpdateEmploymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  organizationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  department?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  positionTitle?: string | null;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string | null;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
