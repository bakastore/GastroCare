import { IsDateString, IsEnum, IsString, MinLength } from 'class-validator';
import { PatientGender } from '@prisma/client';

export class CreatePatientDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsEnum(PatientGender)
  gender!: PatientGender;

  @IsString()
  @MinLength(1)
  phone!: string;
}
