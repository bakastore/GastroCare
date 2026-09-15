import { IsOptional, IsString, MaxLength } from 'class-validator';

/** DEC-021 NR-01 §8 — no contact-channel taxonomy in v1; free-text note only. */
export class ContactAttemptDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
