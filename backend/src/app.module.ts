import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
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
  ],
})
export class AppModule {}
