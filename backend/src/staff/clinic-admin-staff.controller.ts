import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ClinicAdminGuard } from '../clinic-admin/clinic-admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { StaffProfileService } from './staff-profile.service';
import { StaffCredentialsService } from './staff-credentials.service';
import { StaffEmploymentService } from './staff-employment.service';
import { StaffFacilityAssignmentsService } from './staff-facility-assignments.service';
import { PutStaffProfileDto } from './dto/staff-profile.dto';
import { CreateCredentialDto, UpdateCredentialDto } from './dto/credential.dto';
import { CreateEmploymentDto, UpdateEmploymentDto } from './dto/employment.dto';
import {
  CreateFacilityAssignmentDto,
  PatchFacilityAssignmentDto,
} from './dto/facility-assignment.dto';

/**
 * DEC-019 Clinic Admin staff surface. Every route is gated by the existing
 * ClinicAdminGuard and scoped to `actor.tenantId`; `tenantId` is never read
 * from a request body/param.
 */
@UseGuards(ClinicAdminGuard)
@Controller('clinic-admin/users')
export class ClinicAdminStaffController {
  constructor(
    private readonly profiles: StaffProfileService,
    private readonly credentials: StaffCredentialsService,
    private readonly employment: StaffEmploymentService,
    private readonly assignments: StaffFacilityAssignmentsService,
  ) {}

  // ---- Profile ----
  @Get(':id/profile')
  getProfile(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.profiles.getForAdmin(u.tenantId, id);
  }

  @Put(':id/profile')
  putProfile(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PutStaffProfileDto,
  ) {
    return this.profiles.put(u, id, dto);
  }

  @Get(':id/staff-audit')
  staffAudit(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.profiles.getStaffAudit(u.tenantId, id);
  }

  // ---- Credentials ----
  @Get(':id/credentials')
  listCredentials(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.credentials.list(u.tenantId, id);
  }

  @Post(':id/credentials')
  addCredential(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateCredentialDto,
  ) {
    return this.credentials.create(u, id, dto);
  }

  @Patch(':id/credentials/:credentialId')
  patchCredential(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Param('credentialId') credentialId: string,
    @Body() dto: UpdateCredentialDto,
  ) {
    return this.credentials.update(u, id, credentialId, dto);
  }

  @Delete(':id/credentials/:credentialId')
  @HttpCode(HttpStatus.OK)
  deleteCredential(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Param('credentialId') credentialId: string,
  ) {
    return this.credentials.remove(u, id, credentialId);
  }

  // ---- Employment history ----
  @Get(':id/employment-history')
  listEmployment(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.employment.list(u.tenantId, id);
  }

  @Post(':id/employment-history')
  addEmployment(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateEmploymentDto,
  ) {
    return this.employment.create(u, id, dto);
  }

  @Patch(':id/employment-history/:recordId')
  patchEmployment(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() dto: UpdateEmploymentDto,
  ) {
    return this.employment.update(u, id, recordId, dto);
  }

  @Delete(':id/employment-history/:recordId')
  @HttpCode(HttpStatus.OK)
  deleteEmployment(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
  ) {
    return this.employment.remove(u, id, recordId);
  }

  // ---- Facility assignments ----
  @Get(':id/facility-assignments')
  listAssignments(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.assignments.list(u.tenantId, id);
  }

  @Post(':id/facility-assignments')
  addAssignment(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateFacilityAssignmentDto,
  ) {
    return this.assignments.create(u, id, dto);
  }

  @Patch(':id/facility-assignments/:assignmentId')
  patchAssignment(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: PatchFacilityAssignmentDto,
  ) {
    return this.assignments.patch(u, id, assignmentId, dto);
  }
}
