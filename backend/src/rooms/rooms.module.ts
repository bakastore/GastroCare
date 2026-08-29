import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClinicAdminModule } from '../clinic-admin/clinic-admin.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [AuditModule, ClinicAdminModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
