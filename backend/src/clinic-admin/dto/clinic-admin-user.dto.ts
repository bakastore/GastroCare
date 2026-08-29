import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AuthRole } from '@prisma/client';

export class CreateClinicAdminUserDto {
  @IsEmail()
  email: string;

  @IsEnum(AuthRole)
  role: AuthRole;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  isClinicAdmin?: boolean;
}

export class UpdateClinicAdminUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsEnum(AuthRole)
  role?: AuthRole;

  @IsOptional()
  @IsBoolean()
  isClinicAdmin?: boolean;
}
