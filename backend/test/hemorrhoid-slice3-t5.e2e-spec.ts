import { decisionFixture } from './dec016-fixtures';
import { activateHemorrhoidTreatment } from './dec021-activation-helper';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Hemorrhoid Vertical Slice 3 — T5 Timeline/backend integration (e2e),
 * DEC-013 OWNER LOCKED, docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md
 * §U. Timeline remains a read projection (no Timeline table); this only
 * verifies the new minimal named-summary fields for
 * HEMORRHOID_FOLLOW_UP_ASSESSMENT -> responseSummary and
 * HEMORRHOID_NEXT_CLINICAL_DECISION -> decisionSummary, and that the Return
 * Encounter + its events are correctly grouped under the
 * HEMORRHOID_TREATMENT episode bucket (not ungroupedEncounters).
 */
describe('Hemorrhoid Vertical Slice 3 — T5 Timeline/backend integration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantId: string;
  let doctorToken: string;
  let patientId: string;

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
    reasonForVisit = 'Khám trĩ (synthetic, T5)',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        workflowKind: 'HEMORRHOID_INITIAL',
        patientId: patient,
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
      data: { name: 'Hemorrhoid Slice3 T5 Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctorPassword = 'Slice3-T5-DoctorA-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor-t5-slice3@gastrocare.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Hemorrhoid Slice3 T5 Patient',
        normalizedFullName: 'synthetic hemorrhoid slice3 t5 patient',
        dateOfBirth: new Date('1967-05-05'),
        gender: 'MALE',
        phone: 'T5-SYNTH-PATIENT-01',
        normalizedPhone: 'T5-SYNTH-PATIENT-01',
      },
    });
    patientId = patient.id;

    doctorToken = await login(
      'doctor-t5-slice3@gastrocare.test',
      doctorPassword,
    );
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  it('projects HEMORRHOID_FOLLOW_UP_ASSESSMENT.responseSummary and HEMORRHOID_NEXT_CLINICAL_DECISION.decisionSummary into the Timeline, grouped under the HEMORRHOID_TREATMENT episode', async () => {
    // Initial branch through to a signed CarePlan + OPEN generic task.
    const initialEncounterId = await createEncounter(doctorToken, patientId);
    const exam = await createSubmission(
      doctorToken,
      initialEncounterId,
      'HEMORRHOID_EXAMINATION',
      {},
    );
    await completeSubmission(doctorToken, exam.body.id);
    const diagnosis = await createSubmission(
      doctorToken,
      initialEncounterId,
      'HEMORRHOID_DIAGNOSIS',
      { diagnosisSummary: 'x' },
    );
    await completeSubmission(doctorToken, diagnosis.body.id);
    // DEC-021 R9 finding 1 — episode established by Structured Treatment
    // Activation (v3 decision), not by the first Return.
    await activateHemorrhoidTreatment(app, doctorToken, initialEncounterId);
    const carePlan = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ encounterId: initialEncounterId, instructions: 'x', followUpDate: '2026-11-01' })
      .expect(201);
    const signed = await request(app.getHttpServer())
      .post(`/care-plans/${carePlan.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);

    // Return Encounter via the dedicated T2 endpoint.
    const ret = await request(app.getHttpServer())
      .post('/encounters/hemorrhoid-return')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        careTaskId: signed.body.careTask.id,
        occurredAt: new Date().toISOString(),
        reasonForVisit: 'Tái khám (T5, synthetic)',
      })
      .expect(201);
    const episodeId = ret.body.episodeId as string;

    const assessment = await createSubmission(
      doctorToken,
      ret.body.id,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'Cải thiện rõ rệt (T5, synthetic)' },
    );
    await completeSubmission(doctorToken, assessment.body.id);
    const decision2 = await createSubmission(
      doctorToken,
      ret.body.id,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'Ngừng theo dõi (T5, synthetic)' },
    );
    await completeSubmission(doctorToken, decision2.body.id);

    const timelineRes = await request(app.getHttpServer())
      .get(`/patients/${patientId}/timeline`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const episodeGroup = timelineRes.body.episodes.find(
      (g: { episode: { id: string } }) => g.episode.id === episodeId,
    );
    expect(episodeGroup).toBeTruthy();
    expect(episodeGroup.episode.episodeType).toBe('HEMORRHOID_TREATMENT');

    const events = episodeGroup.events as {
      type: string;
      data: Record<string, unknown>;
    }[];

    const returnEncounterEvent = events.find(
      (e) => e.type === 'ENCOUNTER' && e.data.id === ret.body.id,
    );
    expect(returnEncounterEvent).toBeTruthy();

    const assessmentEvent = events.find(
      (e) =>
        e.type === 'CLINICAL_FORM_SUBMITTED' &&
        e.data.templateKey === 'HEMORRHOID_FOLLOW_UP_ASSESSMENT' &&
        e.data.encounterId === ret.body.id,
    );
    expect(assessmentEvent?.data.summary).toBe(
      'Cải thiện rõ rệt (T5, synthetic)',
    );

    const decisionEvent = events.find(
      (e) =>
        e.type === 'CLINICAL_FORM_SUBMITTED' &&
        e.data.templateKey === 'HEMORRHOID_NEXT_CLINICAL_DECISION' &&
        e.data.encounterId === ret.body.id,
    );
    expect(decisionEvent?.data.summary).toBe('Ngừng theo dõi (T5, synthetic)');

    // DEC-021 §5.6 Scenario B — the Initial Encounter activated treatment, so
    // it is grouped under the HEMORRHOID_TREATMENT episode, not ungrouped.
    const ungrouped = timelineRes.body.ungroupedEncounters as {
      type: string;
      data: Record<string, unknown>;
    }[];
    expect(
      ungrouped.find(
        (e) => e.type === 'ENCOUNTER' && e.data.id === initialEncounterId,
      ),
    ).toBeUndefined();
    expect(
      events.find(
        (e) => e.type === 'ENCOUNTER' && e.data.id === initialEncounterId,
      ),
    ).toBeTruthy();
  });
});
