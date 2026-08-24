import { Module } from '@nestjs/common';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { AuditModule } from '../audit/audit.module';
import { CliniciansModule } from '../clinicians/clinicians.module';
import { RoomsModule } from '../rooms/rooms.module';

@Module({
  imports: [AuditModule, CliniciansModule, RoomsModule],
  controllers: [EncountersController],
  providers: [EncountersService],
  exports: [EncountersService],
})
export class EncountersModule {}
