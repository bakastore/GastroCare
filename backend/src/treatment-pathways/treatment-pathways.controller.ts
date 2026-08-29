import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthRole, TreatmentModality } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { TreatmentPathwaysService } from './treatment-pathways.service';
export class CreateTreatmentPathwayDto {
  @IsUUID() caseId!: string;
  @IsEnum(TreatmentModality) modality!: TreatmentModality;
  @IsOptional() @IsString() methodCode?: string;
  @IsISO8601({ strict: true }) startedAt!: string;
}
@Roles(AuthRole.DOCTOR)
@Controller()
export class TreatmentPathwaysController {
  constructor(private readonly service: TreatmentPathwaysService) {}
  @Post('treatment-pathways') create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTreatmentPathwayDto,
  ) {
    return this.service.create(user.tenantId, user.userId, dto);
  }
  @Get('care-episodes/:id/treatment-pathways') list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.list(user.tenantId, id);
  }
}
