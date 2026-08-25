import { Module } from '@nestjs/common';
import { ClinicalFormsController } from './clinical-forms.controller';
import { ClinicalFormsService } from './clinical-forms.service';
import { AuditModule } from '../audit/audit.module';
import { FollowUpTasksModule } from '../follow-up-tasks/follow-up-tasks.module';

@Module({
  imports: [AuditModule, FollowUpTasksModule],
  controllers: [ClinicalFormsController],
  providers: [ClinicalFormsService],
  exports: [ClinicalFormsService],
})
export class ClinicalFormsModule {}
