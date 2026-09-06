import { IsString, Matches, MaxLength } from 'class-validator';

/** DEC-021 NR-01 §8 — reason is mandatory and trimmed. */
export class LostToFollowUpDto {
  @IsString()
  @Matches(/\S/, { message: 'reason must contain non-whitespace characters' })
  @MaxLength(2000)
  reason!: string;
}
