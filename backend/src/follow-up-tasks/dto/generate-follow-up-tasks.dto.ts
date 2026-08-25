import { IsUUID } from 'class-validator';

export class GenerateFollowUpTasksDto {
  @IsUUID()
  sourceEncounterId!: string;
}
