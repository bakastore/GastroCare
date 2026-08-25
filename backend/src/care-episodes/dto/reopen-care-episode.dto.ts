import { IsString, Matches, MaxLength } from 'class-validator';

export class ReopenCareEpisodeDto {
  @IsString()
  @Matches(/\S/, { message: 'reason must contain non-whitespace characters' })
  @MaxLength(500)
  reason!: string;
}
