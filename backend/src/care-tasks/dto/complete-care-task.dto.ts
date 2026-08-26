import { IsOptional, IsUUID } from 'class-validator';

export class CompleteCareTaskDto {
  @IsOptional()
  @IsUUID()
  completedByEncounterId?: string;
}
