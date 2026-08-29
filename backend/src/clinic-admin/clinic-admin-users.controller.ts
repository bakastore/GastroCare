import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClinicAdminGuard } from './clinic-admin.guard';
import { ClinicAdminUsersService } from './clinic-admin-users.service';
import {
  CreateClinicAdminUserDto,
  UpdateClinicAdminUserDto,
} from './dto/clinic-admin-user.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';

@UseGuards(ClinicAdminGuard)
@Controller('clinic-admin/users')
export class ClinicAdminUsersController {
  constructor(private readonly users: ClinicAdminUsersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
  ) {
    return this.users.list(user.tenantId, search);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.users.getById(user.tenantId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClinicAdminUserDto,
  ) {
    return this.users.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateClinicAdminUserDto,
  ) {
    return this.users.update(user, id, dto);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.users.disable(user, id);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.users.reactivate(user, id);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.users.resetPassword(user, id);
  }

  @Get(':id/audit')
  getAudit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.users.getAudit(user.tenantId, id);
  }
}
