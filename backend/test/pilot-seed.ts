import { InvestigationsService } from '../src/investigations/investigations.service';
import { TreatmentPathwaysService } from '../src/treatment-pathways/treatment-pathways.service';
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
// scenario), "Trần Thị Hoa" (CORE-01 test scenario), "Lê Thị Longo" (CORE-04
// Longo pathway) and "Phạm Thị Trĩ" (Hemorrhoid Vertical Slice 1, DEC-010).
// No real patient data.
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { AuthRole, EncounterWorkflowKind, PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PatientsService } from '../src/patients/patients.service';
import { EncountersService } from '../src/encounters/encounters.service';
import { CarePlansService } from '../src/care-plans/care-plans.service';
import { CareTasksService } from '../src/care-tasks/care-tasks.service';
import { ClinicalFormsService } from '../src/clinical-forms/clinical-forms.service';
import { CareEpisodesService } from '../src/care-episodes/care-episodes.service';
import { FacilitiesService } from '../src/facilities/facilities.service';
import { RoomsService } from '../src/rooms/rooms.service';

export const PILOT_DOCTOR_EMAIL = 'doctor.a@example.test';
export const PILOT_DOCTOR_PASSWORD = 'CoreDoctorPilot-Pass1!';
export const PILOT_RECEPTIONIST_EMAIL = 'reception.a@example.test';
export const PILOT_RECEPTIONIST_PASSWORD = 'CoreReceptionPilot-Pass1!';
// Second clinician — used only to demonstrate/seed the responsible-clinician
// handover (DEC-010 §B) for backup/restore + Owner review coverage.
export const PILOT_DOCTOR_B_EMAIL = 'doctor.b@example.test';
export const PILOT_DOCTOR_B_PASSWORD = 'CoreDoctorPilotB-Pass1!';
export const PILOT_NURSE_EMAIL = 'nurse.a@example.test';
export const PILOT_NURSE_PASSWORD = 'CoreNursePilot-Pass1!';

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
    await resetClient.investigationResult.deleteMany();
    await resetClient.investigationOrder.deleteMany();
    await resetClient.investigation.deleteMany();
    await resetClient.clinicalFormSubmission.deleteMany();
    await resetClient.auditEvent.deleteMany();
    await resetClient.careTask.deleteMany();
    await resetClient.carePlanVersion.deleteMany();
    await resetClient.carePlan.deleteMany();
    await resetClient.clinicianAssignmentHistory.deleteMany();
    await resetClient.encounter.deleteMany();
    await resetClient.treatmentPathway.deleteMany();
    await resetClient.careEpisode.deleteMany();
    await resetClient.room.deleteMany();
    await resetClient.facility.deleteMany();
    await resetClient.patient.deleteMany();
    await resetClient.foundationProbeRecord.deleteMany();
    await resetClient.authUser.deleteMany();
    await resetClient.tenant.deleteMany();
  } finally {
    await resetClient.$disconnect();
  }

  // Finding 3 correction — default clinician resolution is fail-closed and
  // requires an explicit config pointing at a real seeded DOCTOR; set it
  // before the Nest application context bootstraps so ConfigModule picks
  // it up. PILOT_DOCTOR_EMAIL is the DOCTOR seeded just below.
  process.env.PILOT_DEFAULT_CLINICIAN_EMAIL = PILOT_DOCTOR_EMAIL;

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
    const pathwaysService = appContext.get(TreatmentPathwaysService);
    const investigationsService = appContext.get(InvestigationsService);
    const facilitiesService = appContext.get(FacilitiesService);
    const roomsService = appContext.get(RoomsService);

    const tenant = await prisma.tenant.create({
      data: { name: 'GastroCare CORE-03 Synthetic Pilot Tenant' },
    });

    // DEC-018 — the synthetic pilot admin. Operational role stays DOCTOR;
    // Clinic Admin is granted as an explicit, independent capability (never
    // inferred from role, never a heuristic backfill in the migration).
    const doctor = await prisma.authUser.create({
      data: {
        email: PILOT_DOCTOR_EMAIL,
        passwordHash: await bcrypt.hash(PILOT_DOCTOR_PASSWORD, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenant.id,
        isClinicAdmin: true,
        displayName: 'BS. Pilot A',
      },
    });
    const receptionist = await prisma.authUser.create({
      data: {
        email: PILOT_RECEPTIONIST_EMAIL,
        passwordHash: await bcrypt.hash(PILOT_RECEPTIONIST_PASSWORD, 10),
        role: AuthRole.RECEPTIONIST,
        tenantId: tenant.id,
      },
    });
    const doctorB = await prisma.authUser.create({
      data: {
        email: PILOT_DOCTOR_B_EMAIL,
        passwordHash: await bcrypt.hash(PILOT_DOCTOR_B_PASSWORD, 10),
        role: AuthRole.DOCTOR,
        tenantId: tenant.id,
      },
    });

    const nurse = await prisma.authUser.create({
      data: {
        email: PILOT_NURSE_EMAIL,
        passwordHash: await bcrypt.hash(PILOT_NURSE_PASSWORD, 10),
        role: AuthRole.NURSE,
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
      AuthRole.DOCTOR,
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

    const signedCarePlan = await carePlansService.sign(
      tenant.id,
      doctor.id,
      carePlan.id,
    );

    await carePlansService.amend(tenant.id, doctor.id, carePlan.id, {
      instructions: 'Điều chỉnh liều thuốc theo đáp ứng, tái khám 14 ngày',
      followUpDate: daysFromNow(14),
      reason: 'Đáp ứng chưa đủ với liều ban đầu',
      expectedCurrentVersionId: signedCarePlan.version.id,
    });

    // CORE-04 T1 — a CareEpisode grouping Minh's return visit, exercising
    // the new table for the Owner Synthetic Dry Run and backup/restore
    // verification. HEMORRHOID_LONGO_FOLLOWUP is not one of the six Longo
    // templates that require episode ancestry, so this linkage is optional
    // realism, not an application-enforced requirement.
    const minhEpisode = await careEpisodesService.create(tenant.id, doctor.id, {
      patientId: minh.id,
      episodeType: 'HEMORRHOID_TREATMENT',
      startedAt: '2026-08-15T09:00:00.000Z',
    });

    const returnEncounter = await encountersService.create(
      tenant.id,
      doctor.id,
      AuthRole.DOCTOR,
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

    const hoaEncounter = await encountersService.create(
      tenant.id,
      doctor.id,
      AuthRole.DOCTOR,
      {
        patientId: hoa.id,
        occurredAt: '2026-08-20T08:30:00.000Z',
        reasonForVisit: 'Đau bụng âm ỉ vùng thượng vị',
        clinicalNote: 'Không sốt, ăn uống kém.',
        assessment: 'Theo dõi loét dạ dày tá tràng',
      },
    );

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

    const longoEpisode = await careEpisodesService.create(
      tenant.id,
      doctor.id,
      {
        patientId: longoPatient.id,
        episodeType: 'HEMORRHOID_TREATMENT',
        startedAt: '2026-07-01T02:00:00.000Z',
      },
    );

    const longoPathway = await pathwaysService.create(tenant.id, doctor.id, {
      caseId: longoEpisode.id,
      modality: 'SURGERY',
      methodCode: 'LONGO',
      startedAt: '2026-07-01T02:00:00.000Z',
    });

    // DEC016: synthetic current and prior evidence, with explicit ancestry.
    const doctorContext = {
      tenantId: tenant.id,
      userId: doctor.id,
      role: doctor.role,
      email: doctor.email,
      isClinicAdmin: doctor.isClinicAdmin,
      mustChangePassword: doctor.mustChangePassword,
    };
    const currentInvestigation = await investigationsService.create(
      doctorContext,
      {
        caseId: longoEpisode.id,
        label: 'CLS giả lập phục vụ kiểm tra backup',
        origin: 'INTERNAL_CURRENT',
      },
    );
    const order = await investigationsService.order(
      doctorContext,
      currentInvestigation.id,
      {
        requestedAt: '2026-07-01T03:00:00.000Z',
        requestText: 'Yêu cầu giả lập',
        assignedToUserId: nurse.id,
      },
    );
    await investigationsService.result(
      {
        tenantId: tenant.id,
        userId: nurse.id,
        role: nurse.role,
        email: nurse.email,
        isClinicAdmin: nurse.isClinicAdmin,
        mustChangePassword: nurse.mustChangePassword,
      },
      currentInvestigation.id,
      {
        orderId: order.id,
        observedAt: '2026-07-01T04:00:00.000Z',
        rawText: 'Kết quả thô giả lập; không diễn giải lâm sàng',
      },
    );
    const priorInvestigation = await investigationsService.create(
      doctorContext,
      {
        caseId: longoEpisode.id,
        label: 'Bằng chứng có trước giả lập',
        origin: 'EXTERNAL_PRIOR',
        parentInvestigationId: currentInvestigation.id,
      },
    );
    await investigationsService.result(doctorContext, priorInvestigation.id, {
      observedAt: '2026-06-01T04:00:00.000Z',
      rawText: 'Bản ghi thô giả lập từ trước; không tạo Order',
    });

    const preopEncounter = await encountersService.create(
      tenant.id,
      doctor.id,
      AuthRole.DOCTOR,
      {
        patientId: longoPatient.id,
        episodeId: longoEpisode.id,
        treatmentPathwayId: longoPathway.id,
        occurredAt: '2026-07-05T02:00:00.000Z',
        reasonForVisit: 'Khám tiền phẫu Longo (dữ liệu tổng hợp)',
        clinicalNote: 'x',
        assessment: 'Chỉ định phẫu thuật Longo',
      },
    );
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
      AuthRole.DOCTOR,
      {
        patientId: longoPatient.id,
        episodeId: longoEpisode.id,
        treatmentPathwayId: longoPathway.id,
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
      AuthRole.DOCTOR,
      {
        patientId: longoPatient.id,
        episodeId: longoEpisode.id,
        treatmentPathwayId: longoPathway.id,
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
      AuthRole.DOCTOR,
      {
        patientId: longoPatient.id,
        episodeId: longoEpisode.id,
        treatmentPathwayId: longoPathway.id,
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
      AuthRole.DOCTOR,
      {
        patientId: longoPatient.id,
        episodeId: longoEpisode.id,
        treatmentPathwayId: longoPathway.id,
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

    // --- Patient 4: Phạm Thị Trĩ — Hemorrhoid Vertical Slice 1 (DEC-010)
    // Facility/Room, responsible-clinician handover, HEMORRHOID_EXAMINATION
    // v1, vital copy-forward and amendment lineage, exercised for the Owner
    // Synthetic Dry Run and backup/restore verification. ---
    const { patient: triPatient } = await patientsService.create(
      tenant.id,
      doctor.id,
      {
        fullName: 'Phạm Thị Trĩ',
        dateOfBirth: '1975-11-20',
        gender: 'FEMALE',
        phone: '0900005555',
      },
    );

    // DEC-018 — Facility/Room creation is a Clinic Admin action; `doctor` is
    // the synthetic pilot Clinic Admin.
    const facility = await facilitiesService.create(
      tenant.id,
      'Cơ sở khám bệnh CORE (dữ liệu tổng hợp)',
      doctor.id,
    );
    const examRoom = await roomsService.create(
      tenant.id,
      {
        facilityId: facility.id,
        name: 'Phòng khám 01',
      },
      doctor.id,
    );

    // Receptionist creates the Encounter Context: no responsibleClinicianId
    // supplied (resolves the pilot default clinician via CliniciansService
    // lookup) and no clinical content yet (DEC-010 §B/§D).
    const triEncounter1 = await encountersService.create(
      tenant.id,
      receptionist.id,
      AuthRole.RECEPTIONIST,
      {
        patientId: triPatient.id,
        roomId: examRoom.id,
        occurredAt: '2026-08-18T02:00:00.000Z',
        reasonForVisit: 'Khám trĩ (dữ liệu tổng hợp)',
        // DEC-015 — this IS the initial Hemorrhoid Encounter for this
        // synthetic patient (mirrors NewHemorrhoidEncounterPage). The later
        // "Tái khám trĩ" Encounter and every generic / Longo-episode-bound
        // Encounter in this seed keep workflowKind = NULL.
        // DEC-020 D20-02 — the Initial Encounter is ungrouped (episodeId
        // null); no HEMORRHOID_TREATMENT CareEpisode is created here.
        workflowKind: EncounterWorkflowKind.HEMORRHOID_INITIAL,
      },
    );

    const triExam1 = await clinicalFormsService.create(tenant.id, doctor.id, {
      encounterId: triEncounter1.id,
      templateKey: 'HEMORRHOID_EXAMINATION',
      responses: {
        historyConstipation: true,
        weight: 54,
        height: 158,
        pulse: 78,
        temperature: 36.8,
        systolicBloodPressure: 118,
        diastolicBloodPressure: 76,
        hemorrhoidGoligherGrade: 'II',
        internalHemorrhoidCount: 2,
        internalHemorrhoidLocation: [3, 7],
        // DEC-010 Finding 2 correction — internal/external/mixed each get
        // an independent size field (mainHemorrhoidSize no longer exists
        // as a competing/duplicate capture field). Only internal is set
        // here to prove the split persists distinctly from the others.
        internalHemorrhoidSize: '1.5cm (dữ liệu tổng hợp)',
        prolapseSymptom: true,
        prolapseObserved: false,
        bleedingSymptom: true,
        bleedingObserved: true,
      },
    });
    await clinicalFormsService.complete(tenant.id, doctor.id, triExam1.id);

    // Handover: responsible clinician changes from doctor -> doctorB,
    // preserving full provenance (ClinicianAssignmentHistory) and emitting
    // an AuditEvent attributed to `doctor` (the actor performing the
    // handover) — the historical ENCOUNTER_CREATED AuditEvent keeps its
    // original actor attribution unchanged.
    await encountersService.handover(tenant.id, doctor.id, triEncounter1.id, {
      newClinicianId: doctorB.id,
      reason: 'Bàn giao ca trực (dữ liệu tổng hợp)',
    });

    const triEncounter2 = await encountersService.create(
      tenant.id,
      doctorB.id,
      AuthRole.DOCTOR,
      {
        patientId: triPatient.id,
        roomId: examRoom.id,
        responsibleClinicianId: doctorB.id,
        occurredAt: '2026-09-01T02:00:00.000Z',
        reasonForVisit: 'Tái khám trĩ (dữ liệu tổng hợp)',
      },
    );

    // Vital copy-forward (DEC-010 §6, Finding 2 correction — target-aware):
    // second examination, later Encounter, pre-filled from triExam1's
    // COMPLETED vitals (looked up by Encounter.occurredAt relative to
    // triEncounter2's own occurredAt, not createdAt), one value edited by
    // the clinician before completion.
    const copyForward = await clinicalFormsService.getVitalsCopyForward(
      tenant.id,
      triEncounter2.id,
    );
    const triExam2 = await clinicalFormsService.create(tenant.id, doctorB.id, {
      encounterId: triEncounter2.id,
      templateKey: 'HEMORRHOID_EXAMINATION',
      responses: {
        ...copyForward?.vitals,
        // Clinician edits the copied weight before completing — proves an
        // edited copy-forward value still persists as this exam's own
        // snapshot, not a live reference to the source.
        weight: (copyForward?.vitals.weight ?? 54) + 1,
        hemorrhoidGoligherGrade: 'II',
        prolapseSymptom: false,
        bleedingSymptom: false,
        bleedingObserved: false,
      },
    });
    await clinicalFormsService.complete(tenant.id, doctorB.id, triExam2.id);
    // One amendment, exercising HEMORRHOID_EXAMINATION amendment lineage.
    await clinicalFormsService.amend(tenant.id, doctorB.id, triExam2.id, {
      responses: {
        ...(triExam2.responses as Record<string, unknown>),
        otherGeneralFinding:
          'Bổ sung ghi chú sau khi xem lại hồ sơ (dữ liệu tổng hợp).',
      },
      amendmentReason: 'Bổ sung ghi chú toàn thân (dữ liệu tổng hợp)',
    });

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
    console.log(
      `Patient 4 (Hemorrhoid Vertical Slice 1 — Facility/Room/handover/vitals copy-forward): ${triPatient.fullName} (${triPatient.id})`,
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
