import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClinicAdminModule } from '../clinic-admin/clinic-admin.module';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesService } from './facilities.service';

@Module({
  imports: [AuditModule, ClinicAdminModule],
  controllers: [FacilitiesController],
  providers: [FacilitiesService],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
