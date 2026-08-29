import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClinicAdminGuard } from './clinic-admin.guard';
import { ClinicAdminUsersController } from './clinic-admin-users.controller';
import { ClinicAdminUsersService } from './clinic-admin-users.service';

/**
 * DEC-018 — Admin Boundary / User Management v1. Canonical namespace
 * `/clinic-admin/*`. Exports ClinicAdminGuard so the Facility/Room modules
 * can gate their write endpoints on the same capability.
 */
@Module({
  imports: [AuditModule],
  controllers: [ClinicAdminUsersController],
  providers: [ClinicAdminGuard, ClinicAdminUsersService],
  exports: [ClinicAdminGuard],
})
export class ClinicAdminModule {}
