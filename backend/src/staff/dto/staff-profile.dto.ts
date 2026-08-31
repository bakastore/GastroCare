import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { StaffSpecialty } from '@prisma/client';

/**
 * PUT /clinic-admin/users/:id/profile — create on first call, update after.
 * Every field is optional at the DTO layer; the service enforces
 * `fullName` on create and all specialty invariants. `tenantId` is NEVER
 * accepted here.
 */
export class PutStaffProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  professionalTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  workPhone?: string | null;

  @IsOptional()
  @IsEnum(StaffSpecialty)
  primarySpecialty?: StaffSpecialty | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsEnum(StaffSpecialty, { each: true })
  secondarySpecialties?: StaffSpecialty[];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialtyOtherLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  biography?: string | null;
}
