import { Module } from '@nestjs/common';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { HemorrhoidReturnEncounterService } from './hemorrhoid-return-encounter.service';
import { HemorrhoidTreatmentActivationService } from './hemorrhoid-treatment-activation.service';
import { AuditModule } from '../audit/audit.module';
import { CliniciansModule } from '../clinicians/clinicians.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [AuditModule, CliniciansModule, RoomsModule],
  controllers: [EncountersController],
  providers: [
    EncountersService,
    HemorrhoidReturnEncounterService,
    HemorrhoidTreatmentActivationService,
  ],
  exports: [EncountersService],
})
export class EncountersModule {}
