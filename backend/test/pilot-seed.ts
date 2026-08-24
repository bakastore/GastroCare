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
import { CareEpisodesService } from '../src/care-episodes/care-episodes.service';

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
    await resetClient.careEpisode.deleteMany();
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
    const careEpisodesService = appContext.get(CareEpisodesService);

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
        occurredAt: '2026-08-01T09:00:00.000Z',
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

    // CORE-04 T1 — a CareEpisode grouping Minh's return visit, exercising
    // the new table for the Owner Synthetic Dry Run and backup/restore
    // verification. HEMORRHOID_LONGO_FOLLOWUP is not one of the six Longo
    // templates that require episode ancestry, so this linkage is optional
    // realism, not an application-enforced requirement.
    const minhEpisode = await careEpisodesService.create(tenant.id, doctor.id, {
      patientId: minh.id,
      episodeType: 'LONGO_TREATMENT',
      startedAt: '2026-08-15T09:00:00.000Z',
    });

    const returnEncounter = await encountersService.create(
      tenant.id,
      doctor.id,
      {
        patientId: minh.id,
        episodeId: minhEpisode.id,
        occurredAt: '2026-08-15T09:00:00.000Z',
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

    // CORE-04 T2 — one amendment, exercising append-only amendment lineage
    // (revision 2) for the Owner Synthetic Dry Run and backup/restore
    // verification. Fictional correction only.
    await clinicalFormsService.amend(tenant.id, doctor.id, clinicalForm.id, {
      responses: {
        visitNumber: 1,
        monthsPostOp: 1,
        vasPain: 3,
        wexnerSolidStool: 0,
        wexnerLiquidStool: 1,
        wexnerGas: 1,
        wexnerPadWearing: 0,
        wexnerLifestyleAlteration: 0,
        additionalNotes:
          'Điều chỉnh điểm đau sau khi xem lại hồ sơ (dữ liệu tổng hợp).',
      },
      amendmentReason:
        'Điều chỉnh điểm VAS ghi nhận ban đầu (dữ liệu tổng hợp)',
    });

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
      occurredAt: '2026-08-20T08:30:00.000Z',
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

    // --- Patient 3: Lê Thị Longo — full CORE-04 Longo pathway
    // (T1-T11 backup/restore + Owner Synthetic Dry Run coverage) ---
    const { patient: longoPatient } = await patientsService.create(
      tenant.id,
      doctor.id,
      {
        fullName: 'Lê Thị Longo',
        dateOfBirth: '1978-09-10',
        gender: 'FEMALE',
        phone: '0900001234',
      },
    );

    const longoEpisode = await careEpisodesService.create(tenant.id, doctor.id, {
      patientId: longoPatient.id,
      episodeType: 'LONGO_TREATMENT',
      startedAt: '2026-07-01T02:00:00.000Z',
    });

    const preopEncounter = await encountersService.create(tenant.id, doctor.id, {
      patientId: longoPatient.id,
      episodeId: longoEpisode.id,
      occurredAt: '2026-07-05T02:00:00.000Z',
      reasonForVisit: 'Khám tiền phẫu Longo (dữ liệu tổng hợp)',
      clinicalNote: 'x',
      assessment: 'Chỉ định phẫu thuật Longo',
    });
    const preopSubmission = await clinicalFormsService.create(
      tenant.id,
      doctor.id,
      {
        encounterId: preopEncounter.id,
        templateKey: 'LONGO_PREOP_ASSESSMENT',
        responses: { weightKg: 58, preopGoligherGrade: 'III' },
      },
    );
    await clinicalFormsService.complete(
      tenant.id,
      doctor.id,
      preopSubmission.id,
    );
    // One amendment, exercising Longo-form amendment lineage.
    await clinicalFormsService.amend(tenant.id, doctor.id, preopSubmission.id, {
      responses: { weightKg: 59, preopGoligherGrade: 'III' },
      amendmentReason: 'Cập nhật cân nặng đo lại (dữ liệu tổng hợp)',
    });

    // Surgery Encounter — the sole postoperative timing anchor for T10
    // follow-up scheduling (Encounter.occurredAt, never createdAt).
    const surgeryEncounter = await encountersService.create(
      tenant.id,
      doctor.id,
      {
        patientId: longoPatient.id,
        episodeId: longoEpisode.id,
        occurredAt: '2026-07-10T07:00:00.000Z',
        reasonForVisit: 'Phẫu thuật Longo (dữ liệu tổng hợp)',
        clinicalNote: 'x',
        assessment: 'x',
      },
    );
    const intraopSubmission = await clinicalFormsService.create(
      tenant.id,
      doctor.id,
      {
        encounterId: surgeryEncounter.id,
        templateKey: 'LONGO_INTRAOP_RECORD',
        responses: { operativeDurationMinutes: 42, bloodLossMl: 25 },
      },
    );
    // Completing this triggers idempotent T10 follow-up task generation
    // (TWO_WEEK/MONTH_1/MONTH_3/MONTH_6) anchored on surgeryEncounter.occurredAt.
    await clinicalFormsService.complete(
      tenant.id,
      doctor.id,
      intraopSubmission.id,
    );

    // Early post-op — same clinical occurrence as the Surgery Encounter.
    const earlyPostopSubmission = await clinicalFormsService.create(
      tenant.id,
      doctor.id,
      {
        encounterId: surgeryEncounter.id,
        templateKey: 'LONGO_EARLY_POSTOP',
        responses: { earlyPostopPainVas: 3, analgesicsUsed: true },
      },
    );
    await clinicalFormsService.complete(
      tenant.id,
      doctor.id,
      earlyPostopSubmission.id,
    );

    // Two-week follow-up visit — completing this deterministically matches
    // and completes the generated TWO_WEEK CareTask (T10).
    const twoWeekEncounter = await encountersService.create(
      tenant.id,
      doctor.id,
      {
        patientId: longoPatient.id,
        episodeId: longoEpisode.id,
        occurredAt: '2026-07-24T02:00:00.000Z',
        reasonForVisit: 'Tái khám 2 tuần (dữ liệu tổng hợp)',
        clinicalNote: 'x',
        assessment: 'x',
      },
    );
    const twoWeekSubmission = await clinicalFormsService.create(
      tenant.id,
      doctor.id,
      {
        encounterId: twoWeekEncounter.id,
        templateKey: 'LONGO_TWO_WEEK_FOLLOWUP',
        responses: { twoWeekPainVas: 1, twoWeekDilationPerformed: false },
      },
    );
    await clinicalFormsService.complete(
      tenant.id,
      doctor.id,
      twoWeekSubmission.id,
    );

    // Anal dilation — one repeated occurrence, its own Encounter + submission.
    const dilationEncounter = await encountersService.create(
      tenant.id,
      doctor.id,
      {
        patientId: longoPatient.id,
        episodeId: longoEpisode.id,
        occurredAt: '2026-08-05T02:00:00.000Z',
        reasonForVisit: 'Nong hậu môn lần 1 (dữ liệu tổng hợp)',
        clinicalNote: 'x',
        assessment: 'x',
      },
    );
    const dilationSubmission = await clinicalFormsService.create(
      tenant.id,
      doctor.id,
      {
        encounterId: dilationEncounter.id,
        templateKey: 'ANAL_DILATION_ASSESSMENT',
        responses: {
          analDiameterNote: '1.5cm (dữ liệu tổng hợp)',
          dilationResistanceNote: 'Nhẹ',
          dilationPainNote: 'Ít đau',
          dilationBleedingNote: 'Không',
          defecationAbilityNote: 'Bình thường',
        },
      },
    );
    await clinicalFormsService.complete(
      tenant.id,
      doctor.id,
      dilationSubmission.id,
    );

    // Month-1 long-term follow-up — completing this matches the MONTH_1
    // CareTask and computes a deterministic Wexner total server-side.
    const month1Encounter = await encountersService.create(
      tenant.id,
      doctor.id,
      {
        patientId: longoPatient.id,
        episodeId: longoEpisode.id,
        occurredAt: '2026-08-10T02:00:00.000Z',
        reasonForVisit: 'Tái khám tháng 1 (dữ liệu tổng hợp)',
        clinicalNote: 'x',
        assessment: 'x',
      },
    );
    const month1Submission = await clinicalFormsService.create(
      tenant.id,
      doctor.id,
      {
        encounterId: month1Encounter.id,
        templateKey: 'LONGO_LONG_TERM_FOLLOWUP',
        responses: {
          plannedTimepoint: 'MONTH_1',
          longTermSolidStool: 1,
          longTermLiquidStool: 0,
          longTermGas: 1,
          longTermPadWearing: 0,
          longTermLifestyleAlteration: 0,
          longTermSatisfaction: 'SATISFIED',
        },
      },
    );
    await clinicalFormsService.complete(
      tenant.id,
      doctor.id,
      month1Submission.id,
    );

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
    console.log(
      `Patient 3 (full Longo pathway, T1-T11): ${longoPatient.fullName} (${longoPatient.id})`,
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
