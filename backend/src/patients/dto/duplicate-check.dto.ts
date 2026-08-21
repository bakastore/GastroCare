import { IsDateString, IsString, MinLength } from 'class-validator';

export class DuplicateCheckDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  @MinLength(1)
  phone!: string;
}
