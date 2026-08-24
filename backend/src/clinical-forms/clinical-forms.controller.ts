import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { ClinicalFormsService } from './clinical-forms.service';
import { CreateClinicalFormSubmissionDto } from './dto/create-submission.dto';
import { UpdateDraftClinicalFormSubmissionDto } from './dto/update-draft-submission.dto';
import { AmendClinicalFormSubmissionDto } from './dto/amend-submission.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

/**
 * Clinical Forms carry detailed clinical content — DOCTOR-only for the
 * entire controller (RECEPTIONIST must not gain access to clinical form
 * responses, see Owner Execution Contract section 38).
 */
@Roles(AuthRole.DOCTOR)
@Controller('clinical-forms')
export class ClinicalFormsController {
  constructor(private readonly clinicalFormsService: ClinicalFormsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClinicalFormSubmissionDto,
  ) {
    return this.clinicalFormsService.create(user.tenantId, user.userId, dto);
  }

  @Get()
  listByPatient(
    @CurrentUser() user: AuthenticatedUser,
    @Query('patientId') patientId?: string,
  ) {
    if (!patientId) {
      throw new BadRequestException('patientId query parameter is required');
    }
    return this.clinicalFormsService.listByPatient(user.tenantId, patientId);
  }

  // Declared before ':id' so 'templates/:templateKey' is not swallowed by
  // the ':id' route.
  @Get('templates/:templateKey')
  getTemplateDefinition(@Param('templateKey') templateKey: string) {
    return this.clinicalFormsService.getTemplateDefinition(templateKey);
  }

  // Declared before ':id' for the same reason as 'templates/:templateKey'.
  // DEC-010 §6 — vital-sign copy-forward for a new HEMORRHOID_EXAMINATION.
  // Finding 2 correction — target-aware: takes the target Encounter id, not
  // a patientId. The backend resolves tenant/patient/occurredAt from that
  // Encounter itself; the frontend must never decide clinical ordering.
  @Get('vitals-copy-forward')
  getVitalsCopyForward(
    @CurrentUser() user: AuthenticatedUser,
    @Query('targetEncounterId') targetEncounterId?: string,
  ) {
    if (!targetEncounterId) {
      throw new BadRequestException(
        'targetEncounterId query parameter is required',
      );
    }
    return this.clinicalFormsService.getVitalsCopyForward(
      user.tenantId,
      targetEncounterId,
    );
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clinicalFormsService.getById(user.tenantId, id);
  }

  @Patch(':id/draft')
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDraftClinicalFormSubmissionDto,
  ) {
    return this.clinicalFormsService.updateDraft(user.tenantId, id, dto);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clinicalFormsService.complete(user.tenantId, user.userId, id);
  }

  @Post(':id/amend')
  amend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AmendClinicalFormSubmissionDto,
  ) {
    return this.clinicalFormsService.amend(user.tenantId, user.userId, id, dto);
  }

  @Get(':id/history')
  getHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clinicalFormsService.getHistory(user.tenantId, id);
  }
}
