// CORE-03 deterministic synthetic pilot dataset — synthetic data only.
//
// Unlike test/e2e-seed.ts (accounts only, for Playwright to build its own
// data), this seeds a FULL walking-skeleton dataset by calling the real
// application services (via a Nest application context) so every write goes
// through the same code path as a real request — real validation, real
// AuditEvent rows, real CareTask auto-creation on sign. Intended for the
// Owner Synthetic Dry Run (see OPERATIONS.md) and for backup/restore
// verification (see scripts/verify-backup-restore.sh).
//
// Fictional data only: "Nguyễn Văn Minh" (Clinical Workflow Baseline
// scenario) and "Trần Thị Hoa" (CORE-01 test scenario). No real patient
// data.
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AuthRole, PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PatientsService } from '../src/patients/patients.service';
import { EncountersService } from '../src/encounters/encounters.service';
import { CarePlansService } from '../src/care-plans/care-plans.service';
import { CareTasksService } from '../src/care-tasks/care-tasks.service';
import { ClinicalFormsService } from '../src/clinical-forms/clinical-forms.service';

export const PILOT_DOCTOR_EMAIL = 'doctor.a@example.test';
export const PILOT_DOCTOR_PASSWORD = 'CoreDoctorPilot-Pass1!';
export const PILOT_RECEPTIONIST_EMAIL = 'reception.a@example.test';
export const PILOT_RECEPTIONIST_PASSWORD = 'CoreReceptionPilot-Pass1!';

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function seedPilotDataset(): Promise<void> {
  // Reset with a plain PrismaClient first (fast, no Nest bootstrap needed
  // for a delete-only pass) — same table order as test/e2e-seed.ts.
  const resetClient = new PrismaClient();
  try {
    await resetClient.clinicalFormSubmission.deleteMany();
    await resetClient.auditEvent.deleteMany();
    await resetClient.careTask.deleteMany();
    await resetClient.carePlanVersion.deleteMany();
    await resetClient.carePlan.deleteMany();
    await resetClient.encounter.deleteMany();
    await resetClient.patient.deleteMany();
    await resetClient.foundationProbeRecord.deleteMany();
    await resetClient.authUser.deleteMany();
    await resetClient.tenant.deleteMany();
  } finally {
    await resetClient.$disconnect();
  }

  const appContext = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const prisma = appContext.get(PrismaService);
    const patientsService = appContext.get(PatientsService);
    const encountersService = appContext.get(EncountersService);
    const carePlansService = appContext.get(CarePlansService);
    const careTasksService = appContext.get(CareTasksService);
    const clinicalFormsService = appContext.get(ClinicalFormsService);

    const tenant = await prisma.tenant.create({
      data: { name: 'GastroCare CORE-03 Synthetic Pilot Tenant' },
    });

    const doctor = await prisma.authUser.create({
      data: {
        email: PILOT_DOCTOR_EMAIL,
        passwordHash: await bcrypt.hash(PILOT_DOCTOR_PASSWORD, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenant.id,
      },
    });
    await prisma.authUser.create({
      data: {
        email: PILOT_RECEPTIONIST_EMAIL,
        passwordHash: await bcrypt.hash(PILOT_RECEPTIONIST_PASSWORD, 10),
        role: AuthRole.RECEPTIONIST,
        tenantId: tenant.id,
      },
    });

    // --- Patient 1: Nguyễn Văn Minh — full lifecycle (Scenarios 1, 2, 4) ---
    const { patient: minh } = await patientsService.create(
      tenant.id,
      doctor.id,
      {
        fullName: 'Nguyễn Văn Minh',
        dateOfBirth: '1984-03-15',
        gender: 'MALE',
        phone: '0901234567',
      },
    );

    const initialEncounter = await encountersService.create(
      tenant.id,
      doctor.id,
      {
        patientId: minh.id,
        reasonForVisit: 'Đau thượng vị 6 tuần, đầy bụng, ợ nóng',
        clinicalNote: 'Không nôn máu, không phân đen.',
        assessment: 'Theo dõi viêm dạ dày / GERD',
      },
    );

    const carePlan = await carePlansService.create(tenant.id, doctor.id, {
      encounterId: initialEncounter.id,
      instructions: 'Điều trị theo đơn, tái khám 14 ngày',
      followUpDate: daysFromNow(14),
    });

    await carePlansService.sign(tenant.id, doctor.id, carePlan.id);

    await carePlansService.amend(tenant.id, doctor.id, carePlan.id, {
      instructions: 'Điều chỉnh liều thuốc theo đáp ứng, tái khám 14 ngày',
      followUpDate: daysFromNow(14),
      reason: 'Đáp ứng chưa đủ với liều ban đầu',
    });

    const returnEncounter = await encountersService.create(
      tenant.id,
      doctor.id,
      {
        patientId: minh.id,
        reasonForVisit: 'Tái khám sau 14 ngày',
        clinicalNote: 'Đỡ đau thượng vị, còn đầy bụng nhẹ.',
        assessment: 'Cải thiện, tiếp tục theo dõi',
      },
    );

    // Real-world clinical form alignment (CORE-03) — one completed synthetic
    // HEMORRHOID_LONGO_FOLLOWUP submission, exercising the new Clinical
    // Forms table for the Owner Synthetic Dry Run and backup/restore
    // verification. Fictional responses only.
    const clinicalForm = await clinicalFormsService.create(
      tenant.id,
      doctor.id,
      {
        encounterId: returnEncounter.id,
        templateKey: 'HEMORRHOID_LONGO_FOLLOWUP',
        responses: {
          visitNumber: 1,
          monthsPostOp: 1,
          vasPain: 2,
          wexnerSolidStool: 0,
          wexnerLiquidStool: 1,
          wexnerGas: 1,
          wexnerPadWearing: 0,
          wexnerLifestyleAlteration: 0,
          additionalNotes:
            'Diễn biến ổn định (dữ liệu tổng hợp cho pilot dry run).',
        },
      },
    );
    await clinicalFormsService.complete(tenant.id, doctor.id, clinicalForm.id);

    const minhTasks = await prisma.careTask.findMany({
      where: { tenantId: tenant.id, patientId: minh.id },
    });
    for (const task of minhTasks) {
      await careTasksService.complete(tenant.id, doctor.id, task.id);
    }

    // --- Patient 2: Trần Thị Hoa — OPEN + overdue follow-up (Scenario 6) ---
    const { patient: hoa } = await patientsService.create(
      tenant.id,
      doctor.id,
      {
        fullName: 'Trần Thị Hoa',
        dateOfBirth: '1990-06-01',
        gender: 'FEMALE',
        phone: '0909998888',
      },
    );

    const hoaEncounter = await encountersService.create(tenant.id, doctor.id, {
      patientId: hoa.id,
      reasonForVisit: 'Đau bụng âm ỉ vùng thượng vị',
      clinicalNote: 'Không sốt, ăn uống kém.',
      assessment: 'Theo dõi loét dạ dày tá tràng',
    });

    const hoaCarePlan = await carePlansService.create(tenant.id, doctor.id, {
      encounterId: hoaEncounter.id,
      instructions: 'Điều trị theo đơn, tái khám sau 7 ngày',
      followUpDate: daysAgo(3),
    });
    await carePlansService.sign(tenant.id, doctor.id, hoaCarePlan.id);
    // Intentionally left OPEN + overdue — do not complete this one.

    console.log('CORE-03 synthetic pilot dataset seeded.');
    console.log(`Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`Doctor: ${PILOT_DOCTOR_EMAIL} / ${PILOT_DOCTOR_PASSWORD}`);
    console.log(
      `Receptionist: ${PILOT_RECEPTIONIST_EMAIL} / ${PILOT_RECEPTIONIST_PASSWORD}`,
    );
    console.log(
      `Patient 1 (full lifecycle, completed task): ${minh.fullName} (${minh.id})`,
    );
    console.log(
      `Patient 2 (OPEN overdue follow-up): ${hoa.fullName} (${hoa.id})`,
    );
  } finally {
    await appContext.close();
  }
}

if (require.main === module) {
  seedPilotDataset().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
