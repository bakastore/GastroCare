import { IsISO8601, IsIn, IsUUID } from 'class-validator';
import { HEMORRHOID_TREATMENT_EPISODE_TYPE } from '../../clinical-forms/templates/hemorrhoid-continuous-care';

// HEMORRHOID_TREATMENT added — Hemorrhoid Vertical Slice 3 T4 (DEC-013 §C,
// §L; docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md §L). Unlike
// LONGO_TREATMENT, direct creation of this type is guarded in
// CareEpisodesService.create() against producing a second ACTIVE episode
// for the same tenant+patient — see the 0..1 ACTIVE invariant there.
export const CARE_EPISODE_TYPES = [
  'LONGO_TREATMENT',
  HEMORRHOID_TREATMENT_EPISODE_TYPE,
] as const;

export class CreateCareEpisodeDto {
  @IsUUID()
  patientId!: string;

  @IsIn(CARE_EPISODE_TYPES)
  episodeType!: (typeof CARE_EPISODE_TYPES)[number];

  @IsISO8601({ strict: true })
  startedAt!: string;
}
