import { Module } from '@nestjs/common';
import { TreatmentPathwaysController } from './treatment-pathways.controller';
import { TreatmentPathwaysService } from './treatment-pathways.service';
@Module({
  controllers: [TreatmentPathwaysController],
  providers: [TreatmentPathwaysService],
})
export class TreatmentPathwaysModule {}
