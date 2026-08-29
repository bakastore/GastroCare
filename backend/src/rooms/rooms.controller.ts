import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ClinicAdminGuard } from '../clinic-admin/clinic-admin.guard';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // DEC-018 — writing a Room is a Clinic Admin capability, not an
  // operational DOCTOR-role power.
  @UseGuards(ClinicAdminGuard)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(user.tenantId, dto, user.userId);
  }

  @Roles(AuthRole.DOCTOR, AuthRole.RECEPTIONIST)
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('facilityId') facilityId?: string,
  ) {
    if (!facilityId) {
      throw new BadRequestException('facilityId query parameter is required');
    }
    return this.roomsService.listByFacility(user.tenantId, facilityId);
  }

  @Roles(AuthRole.DOCTOR, AuthRole.RECEPTIONIST)
  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.roomsService.getById(user.tenantId, id);
  }
}
