import { IsISO8601 } from 'class-validator';

export class RescheduleFollowUpTaskDto {
  @IsISO8601({ strict: true })
  dueDate!: string;
}
