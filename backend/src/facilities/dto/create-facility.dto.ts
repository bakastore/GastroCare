import { IsString, MinLength } from 'class-validator';

export class CreateFacilityDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
