import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsUUID()
  facilityId!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}
