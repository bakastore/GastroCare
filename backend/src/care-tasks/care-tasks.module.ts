import { Module } from '@nestjs/common';
import { CareTasksController } from './care-tasks.controller';
import { CareTasksService } from './care-tasks.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [CareTasksController],
  providers: [CareTasksService],
  exports: [CareTasksService],
})
export class CareTasksModule {}
