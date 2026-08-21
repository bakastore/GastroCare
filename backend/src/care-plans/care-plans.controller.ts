import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { CarePlansService } from './care-plans.service';
import { CreateCarePlanDto } from './dto/create-care-plan.dto';
import { UpdateDraftCarePlanDto } from './dto/update-draft-care-plan.dto';
import { AmendCarePlanDto } from './dto/amend-care-plan.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Roles(AuthRole.DOCTOR)
@Controller('care-plans')
export class CarePlansController {
  constructor(private readonly carePlansService: CarePlansService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCarePlanDto,
  ) {
    return this.carePlansService.create(user.tenantId, user.userId, dto);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.carePlansService.getById(user.tenantId, id);
  }

  @Patch(':id/draft')
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDraftCarePlanDto,
  ) {
    return this.carePlansService.updateDraft(user.tenantId, id, dto);
  }

  @Post(':id/sign')
  sign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.carePlansService.sign(user.tenantId, user.userId, id);
  }

  @Post(':id/amend')
  amend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AmendCarePlanDto,
  ) {
    return this.carePlansService.amend(user.tenantId, user.userId, id, dto);
  }
}
