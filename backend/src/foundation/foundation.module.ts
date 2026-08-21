import { Module } from '@nestjs/common';
import { FoundationController } from './foundation.controller';
import { FoundationService } from './foundation.service';

@Module({
  controllers: [FoundationController],
  providers: [FoundationService],
})
export class FoundationModule {}
