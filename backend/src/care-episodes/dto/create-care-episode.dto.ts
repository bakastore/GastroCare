import { IsISO8601, IsIn, IsUUID } from 'class-validator';

export const CARE_EPISODE_TYPES = ['LONGO_TREATMENT'] as const;

export class CreateCareEpisodeDto {
  @IsUUID()
  patientId!: string;

  @IsIn(CARE_EPISODE_TYPES)
  episodeType!: (typeof CARE_EPISODE_TYPES)[number];

  @IsISO8601({ strict: true })
  startedAt!: string;
}
