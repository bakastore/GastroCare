import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClinicAdminModule } from '../clinic-admin/clinic-admin.module';
import { ClinicAdminStaffController } from './clinic-admin-staff.controller';
import { MeStaffProfileController } from './me-staff-profile.controller';
import { StaffAccessService } from './staff-access.service';
import { StaffProfileService } from './staff-profile.service';
import { StaffCredentialsService } from './staff-credentials.service';
import { StaffEmploymentService } from './staff-employment.service';
import { StaffFacilityAssignmentsService } from './staff-facility-assignments.service';

/**
 * DEC-019 — Staff Profile & Credential Management v1. Imports ClinicAdminModule
 * for the shared ClinicAdminGuard (no new guard, no generic permission
 * engine). PrismaService is global.
 */
@Module({
  imports: [AuditModule, ClinicAdminModule],
  controllers: [ClinicAdminStaffController, MeStaffProfileController],
  providers: [
    StaffAccessService,
    StaffProfileService,
    StaffCredentialsService,
    StaffEmploymentService,
    StaffFacilityAssignmentsService,
  ],
})
export class StaffModule {}
