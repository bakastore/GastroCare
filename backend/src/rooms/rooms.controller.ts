import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AuthRole } from '@prisma/client';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Roles(AuthRole.DOCTOR)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(user.tenantId, dto);
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
