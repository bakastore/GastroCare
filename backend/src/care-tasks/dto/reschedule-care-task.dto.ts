import { IsDateString } from 'class-validator';

export class RescheduleCareTaskDto {
  @IsDateString()
  dueDate!: string;
}
