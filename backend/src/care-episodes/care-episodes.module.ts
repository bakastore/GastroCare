import { Module } from '@nestjs/common';
import { CareEpisodesController } from './care-episodes.controller';
import { CareEpisodesService } from './care-episodes.service';

@Module({
  controllers: [CareEpisodesController],
  providers: [CareEpisodesService],
  exports: [CareEpisodesService],
})
export class CareEpisodesModule {}
