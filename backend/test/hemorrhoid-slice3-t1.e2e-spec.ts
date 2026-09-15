import { decisionFixture } from './dec016-fixtures';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole, CareEpisodeStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Hemorrhoid Vertical Slice 3 — T1 templates + ancestry/sequence (e2e),
 * DEC-013 OWNER LOCKED, docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md
 * §D, §E, §N, §O.
 *
 * T1 scope only: HEMORRHOID_FOLLOW_UP_ASSESSMENT v1 +
 * HEMORRHOID_NEXT_CLINICAL_DECISION v1 template registration, the
 * continuous-care CareEpisode ancestry guard, and the
 * Assessment -> Next-Decision sequence prerequisite. The dedicated
 * `POST /encounters/hemorrhoid-return` orchestration endpoint (T2) does not
 * exist yet, so Return Encounters here are simulated by a DOCTOR creating an
 * Encounter directly attached to a pre-existing CareEpisode via
 * `POST /encounters` (already-existing, unrelated-to-T2 capability) — this
 * is sufficient to exercise every T1 guard in isolation.
 */
describe('Hemorrhoid Vertical Slice 3 — T1 templates + ancestry/sequence (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantId: string;
  let doctorToken: string;
  let patientId: string;
  let patient2Id: string;

  async function resetTables() {
    await prisma.auditEvent.deleteMany();
    await prisma.investigationResult.deleteMany();
    await prisma.investigationOrder.deleteMany();
    await prisma.investigation.deleteMany();
    await prisma.clinicalFormSubmission.deleteMany();
    await prisma.careTask.deleteMany();
    await prisma.carePlanVersion.deleteMany();
    await prisma.carePlan.deleteMany();
    await prisma.clinicianAssignmentHistory.deleteMany();
    await prisma.encounter.deleteMany();
    await prisma.treatmentPathway.deleteMany();
    await prisma.careEpisode.deleteMany();
    await prisma.room.deleteMany();
    await prisma.facility.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.foundationProbeRecord.deleteMany();
    await prisma.authUser.deleteMany();
    await prisma.tenant.deleteMany();
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  async function createEncounter(
    token: string,
    patient: string,
    episodeId?: string,
    reasonForVisit = 'Khám trĩ (synthetic, T1)',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patient,
        episodeId,
        occurredAt: new Date().toISOString(),
        reasonForVisit,
      })
      .expect(201);
    return res.body.id as string;
  }

  async function createSubmission(
    token: string,
    encounterId: string,
    templateKey: string,
    responses: Record<string, unknown>,
  ) {
    return request(app.getHttpServer())
      .post('/clinical-forms')
      .set('Authorization', `Bearer ${token}`)
      .send({ encounterId, templateKey, responses: decisionFixture(templateKey, responses) });
  }

  async function completeSubmission(token: string, id: string) {
    return request(app.getHttpServer())
      .post(`/clinical-forms/${id}/complete`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function createActiveHemorrhoidEpisode(
    patient: string,
    startedAt: Date = new Date(),
  ) {
    // DEC-021 §4.1 — the partial unique index now allows at most one ACTIVE
    // HEMORRHOID_TREATMENT episode per (tenant, patient). This synthetic
    // helper is called once per test with a shared patient and no per-test
    // reset, so retire any prior ACTIVE episode first.
    await prisma.careEpisode.updateMany({
      where: {
        tenantId,
        patientId: patient,
        episodeType: 'HEMORRHOID_TREATMENT',
        status: CareEpisodeStatus.ACTIVE,
      },
      data: { status: CareEpisodeStatus.CLOSED, endedAt: new Date() },
    });
    return prisma.careEpisode.create({
      data: {
        tenantId,
        patientId: patient,
        episodeType: 'HEMORRHOID_TREATMENT',
        status: CareEpisodeStatus.ACTIVE,
        startedAt,
      },
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    await resetTables();

    const tenant = await prisma.tenant.create({
      data: { name: 'Hemorrhoid Slice3 T1 Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctorPassword = 'Slice3-T1-DoctorA-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor-t1-slice3@gastrocare.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Hemorrhoid Slice3 T1 Patient',
        normalizedFullName: 'synthetic hemorrhoid slice3 t1 patient',
        dateOfBirth: new Date('1970-01-01'),
        gender: 'MALE',
        phone: 'T1-SYNTH-PATIENT-01',
        normalizedPhone: 'T1-SYNTH-PATIENT-01',
      },
    });
    patientId = patient.id;

    const patient2 = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Hemorrhoid Slice3 T1 Patient Two',
        normalizedFullName: 'synthetic hemorrhoid slice3 t1 patient two',
        dateOfBirth: new Date('1972-02-02'),
        gender: 'FEMALE',
        phone: 'T1-SYNTH-PATIENT-02',
        normalizedPhone: 'T1-SYNTH-PATIENT-02',
      },
    });
    patient2Id = patient2.id;

    doctorToken = await login(
      'doctor-t1-slice3@gastrocare.test',
      doctorPassword,
    );
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  // ==========================================================================
  // Positive cases
  // ==========================================================================

  it('accepts HEMORRHOID_FOLLOW_UP_ASSESSMENT on an Encounter belonging to an ACTIVE HEMORRHOID_TREATMENT episode, and persists responseSummary', async () => {
    const episode = await createActiveHemorrhoidEpisode(patientId);
    const encounterId = await createEncounter(doctorToken, patientId, episode.id);

    const created = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'Bệnh nhân cải thiện (T1 positive, synthetic)' },
    );
    expect(created.status).toBe(201);
    const completed = await completeSubmission(doctorToken, created.body.id);
    expect(completed.status).toBe(201);
    expect(completed.body.responses.responseSummary).toBe(
      'Bệnh nhân cải thiện (T1 positive, synthetic)',
    );
  });

  it('allows HEMORRHOID_NEXT_CLINICAL_DECISION after a COMPLETED Follow-up Assessment on the same Encounter, and persists decisionSummary', async () => {
    const episode = await createActiveHemorrhoidEpisode(patientId);
    const encounterId = await createEncounter(doctorToken, patientId, episode.id);

    const assessment = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    await completeSubmission(doctorToken, assessment.body.id);

    const decision = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'Tiếp tục theo dõi (T1 positive, synthetic)' },
    );
    expect(decision.status).toBe(201);
    const completed = await completeSubmission(doctorToken, decision.body.id);
    expect(completed.status).toBe(201);
    expect(completed.body.responses.decisionSummary).toBe(
      'Tiếp tục theo dõi (T1 positive, synthetic)',
    );
  });

  it('preserves the existing initial Hemorrhoid sequence (Examination -> Diagnosis -> Treatment Decision) unaffected', async () => {
    const encounterId = await createEncounter(doctorToken, patientId);
    const exam = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_EXAMINATION',
      {},
    );
    expect(exam.status).toBe(201);
    await completeSubmission(doctorToken, exam.body.id);

    const diagnosis = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_DIAGNOSIS',
      { diagnosisSummary: 'x' },
    );
    expect(diagnosis.status).toBe(201);
    await completeSubmission(doctorToken, diagnosis.body.id);

    const decision = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_TREATMENT_DECISION',
      { decisionSummary: 'x' },
    );
    expect(decision.status).toBe(201);
  });

  // ==========================================================================
  // Negative cases — Contract §D, §E, §N, §O
  // ==========================================================================

  it('rejects HEMORRHOID_FOLLOW_UP_ASSESSMENT on the permanently ungrouped initial Encounter', async () => {
    const encounterId = await createEncounter(doctorToken, patientId);
    const res = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    expect(res.status).toBe(403);
  });

  it('rejects HEMORRHOID_FOLLOW_UP_ASSESSMENT on an Encounter belonging to a Longo (non-Hemorrhoid) episode', async () => {
    const longoEpisode = await prisma.careEpisode.create({
      data: {
        tenantId,
        patientId,
        episodeType: 'LONGO_TREATMENT',
        status: CareEpisodeStatus.ACTIVE,
        startedAt: new Date(),
      },
    });
    const doctor=await prisma.authUser.findFirstOrThrow({where:{tenantId,role:'DOCTOR'}});
    const encounterId=(await prisma.encounter.create({data:{tenantId,patientId,episodeId:longoEpisode.id,responsibleClinicianId:doctor.id,createdByUserId:doctor.id,occurredAt:new Date(),reasonForVisit:'synthetic historical ancestry'}})).id;
    const res = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    expect(res.status).toBe(403);
  });

  it('rejects HEMORRHOID_FOLLOW_UP_ASSESSMENT on an Encounter belonging to a CLOSED HEMORRHOID_TREATMENT episode', async () => {
    const episode = await prisma.careEpisode.create({
      data: {
        tenantId,
        patientId,
        episodeType: 'HEMORRHOID_TREATMENT',
        status: CareEpisodeStatus.CLOSED,
        startedAt: new Date(),
        endedAt: new Date(),
      },
    });
    const doctor=await prisma.authUser.findFirstOrThrow({where:{tenantId,role:'DOCTOR'}});
    const encounterId=(await prisma.encounter.create({data:{tenantId,patientId,episodeId:episode.id,responsibleClinicianId:doctor.id,createdByUserId:doctor.id,occurredAt:new Date(),reasonForVisit:'synthetic historical ancestry'}})).id;
    const res = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    expect(res.status).toBe(403);
  });

  it('rejects cross-patient ancestry: an Encounter cannot attach to another patient’s ACTIVE HEMORRHOID_TREATMENT episode', async () => {
    const episode = await createActiveHemorrhoidEpisode(patientId);
    // The Encounter itself must belong to the same patient as the episode
    // (enforced by EncountersService.create) — attempting to attach
    // patient2's Encounter to patient1's episode is rejected before this
    // Encounter can even exist, which is the correct outer boundary for
    // this invariant.
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId: patient2Id,
        episodeId: episode.id,
        occurredAt: new Date().toISOString(),
        reasonForVisit: 'Khám trĩ (cross-patient negative, synthetic)',
      });
    expect(res.status).toBe(400);
  });

  it('rejects HEMORRHOID_NEXT_CLINICAL_DECISION before a completed Follow-up Assessment exists at all', async () => {
    const episode = await createActiveHemorrhoidEpisode(patientId);
    const encounterId = await createEncounter(doctorToken, patientId, episode.id);
    const res = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'x' },
    );
    expect(res.status).toBe(409);
  });

  it('rejects HEMORRHOID_NEXT_CLINICAL_DECISION while the Follow-up Assessment on the same Encounter is still DRAFT (incomplete)', async () => {
    const episode = await createActiveHemorrhoidEpisode(patientId);
    const encounterId = await createEncounter(doctorToken, patientId, episode.id);
    const assessment = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    expect(assessment.status).toBe(201);
    // Deliberately never completed.
    const res = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'x' },
    );
    expect(res.status).toBe(409);
  });

  it('rejects HEMORRHOID_NEXT_CLINICAL_DECISION when the completed Follow-up Assessment is on a DIFFERENT Encounter', async () => {
    const episode = await createActiveHemorrhoidEpisode(patientId);
    const firstEncounterId = await createEncounter(
      doctorToken,
      patientId,
      episode.id,
    );
    const assessment = await createSubmission(
      doctorToken,
      firstEncounterId,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    await completeSubmission(doctorToken, assessment.body.id);

    // Same ACTIVE episode, but a different Encounter with no Assessment of
    // its own.
    const secondEncounterId = await createEncounter(
      doctorToken,
      patientId,
      episode.id,
    );
    const res = await createSubmission(
      doctorToken,
      secondEncounterId,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'x' },
    );
    expect(res.status).toBe(409);
  });

  it('required responseSummary rejects an empty Follow-up Assessment on complete()', async () => {
    const episode = await createActiveHemorrhoidEpisode(patientId);
    const encounterId = await createEncounter(doctorToken, patientId, episode.id);
    const created = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      {},
    );
    expect(created.status).toBe(201);
    const completed = await completeSubmission(doctorToken, created.body.id);
    expect(completed.status).toBe(400);
  });

  it('required decisionSummary rejects an empty Next Clinical Decision on complete()', async () => {
    const episode = await createActiveHemorrhoidEpisode(patientId);
    const encounterId = await createEncounter(doctorToken, patientId, episode.id);
    const assessment = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'x' },
    );
    await completeSubmission(doctorToken, assessment.body.id);

    const created = await createSubmission(
      doctorToken,
      encounterId,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      {},
    );
    expect(created.status).toBe(201);
    const completed = await completeSubmission(doctorToken, created.body.id);
    expect(completed.status).toBe(400);
  });
});
