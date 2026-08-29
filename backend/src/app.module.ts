import { InvestigationsModule } from './investigations/investigations.module';
import { TreatmentPathwaysModule } from './treatment-pathways/treatment-pathways.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { MustChangePasswordGuard } from './auth/must-change-password.guard';
import { HealthModule } from './health/health.module';
import { FoundationModule } from './foundation/foundation.module';
import { AuditModule } from './audit/audit.module';
import { PatientsModule } from './patients/patients.module';
import { EncountersModule } from './encounters/encounters.module';
import { CarePlansModule } from './care-plans/care-plans.module';
import { CareTasksModule } from './care-tasks/care-tasks.module';
import { ClinicalFormsModule } from './clinical-forms/clinical-forms.module';
import { CareEpisodesModule } from './care-episodes/care-episodes.module';
import { FollowUpTasksModule } from './follow-up-tasks/follow-up-tasks.module';
import { CliniciansModule } from './clinicians/clinicians.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { RoomsModule } from './rooms/rooms.module';
import { ClinicAdminModule } from './clinic-admin/clinic-admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    FoundationModule,
    AuditModule,
    PatientsModule,
    EncountersModule,
    CarePlansModule,
    CareTasksModule,
    ClinicalFormsModule,
    CareEpisodesModule,
    FollowUpTasksModule,
    CliniciansModule,
    FacilitiesModule,
    RoomsModule,
    TreatmentPathwaysModule,
    InvestigationsModule,
    ClinicAdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: MustChangePasswordGuard,
    },
  ],
})
export class AppModule {}
