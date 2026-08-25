import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { FacilitiesService } from './facilities.service';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Roles(AuthRole.DOCTOR)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFacilityDto,
  ) {
    return this.facilitiesService.create(user.tenantId, dto.name);
  }

  @Roles(AuthRole.DOCTOR, AuthRole.RECEPTIONIST)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.facilitiesService.listByTenant(user.tenantId);
  }

  @Roles(AuthRole.DOCTOR, AuthRole.RECEPTIONIST)
  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.facilitiesService.getById(user.tenantId, id);
  }
}
