import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthRole, InvestigationOrigin } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { InvestigationsService } from './investigations.service';
export class CreateInvestigationDto {
  @IsUUID() caseId!: string;
  @IsEnum(InvestigationOrigin) origin!: InvestigationOrigin;
  @IsString() @Matches(/\S/) @MaxLength(500) label!: string;
  @IsOptional() @IsUUID() parentInvestigationId?: string;
}
export class InvestigationParentDto {
  @IsUUID() parentInvestigationId!: string;
}
export class InvestigationOrderDto {
  @IsISO8601({ strict: true }) requestedAt!: string;
  @IsString() @Matches(/\S/) @MaxLength(10000) requestText!: string;
  @IsOptional() @IsUUID() assignedToUserId?: string;
}
export class InvestigationResultDto {
  @IsOptional() @IsUUID() orderId?: string;
  @IsISO8601({ strict: true }) observedAt!: string;
  @IsString() @Matches(/\S/) @MaxLength(50000) rawText!: string;
}
@Roles(AuthRole.DOCTOR)
@Controller()
export class InvestigationsController {
  constructor(private readonly service: InvestigationsService) {}
  @Get('investigations/assignees') assignees(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.assignees(u);
  }
  @Post('investigations') create(
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: CreateInvestigationDto,
  ) {
    return this.service.create(u, dto);
  }
  @Get('care-episodes/:id/investigations') list(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.list(u, id);
  }
  @Roles(AuthRole.DOCTOR, AuthRole.NURSE)
  @Get('investigations/assigned')
  assigned(@CurrentUser() u: AuthenticatedUser) {
    return this.service.assigned(u);
  }
  @Roles(AuthRole.DOCTOR, AuthRole.NURSE)
  @Get('investigations/:id')
  get(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.service.get(u, id);
  }
  @Patch('investigations/:id/parent') parent(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InvestigationParentDto,
  ) {
    return this.service.parent(u, id, dto.parentInvestigationId);
  }
  @Post('investigations/:id/orders') order(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InvestigationOrderDto,
  ) {
    return this.service.order(u, id, dto);
  }
  @Roles(AuthRole.DOCTOR, AuthRole.NURSE)
  @Post('investigations/:id/results')
  result(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InvestigationResultDto,
  ) {
    return this.service.result(u, id, dto);
  }
}
