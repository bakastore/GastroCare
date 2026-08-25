import { Module } from '@nestjs/common';
import { FollowUpTasksController } from './follow-up-tasks.controller';
import { FollowUpTasksService } from './follow-up-tasks.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [FollowUpTasksController],
  providers: [FollowUpTasksService],
  exports: [FollowUpTasksService],
})
export class FollowUpTasksModule {}
