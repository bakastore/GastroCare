import { Module } from '@nestjs/common';
import { ClinicalFormsController } from './clinical-forms.controller';
import { ClinicalFormsService } from './clinical-forms.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ClinicalFormsController],
  providers: [ClinicalFormsService],
  exports: [ClinicalFormsService],
})
export class ClinicalFormsModule {}
