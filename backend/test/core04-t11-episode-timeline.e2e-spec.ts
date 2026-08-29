import { createLongoPathway } from './dec016-fixtures';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * CORE-04 T11 — Episode-aware Timeline (e2e). Gate E.
 *
 * Timeline stays a read projection: groups by CareEpisode, supports
 * Encounters with episodeId = null, sorts by clinical time
 * (Encounter.occurredAt, not createdAt), and preserves amendment lineage
 * (never hides an original revision behind a later amendment). Synthetic
 * data only.
 */
describe('CORE-04 T11 — Episode-aware Timeline (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let tenantId: string;
  let doctorToken: string;
  let patientId: string;

  async function resetTables() {
    await prisma.investigationResult.deleteMany();
    await prisma.investigationOrder.deleteMany();
    await prisma.investigation.deleteMany();
    await prisma.clinicalFormSubmission.deleteMany();
    await prisma.auditEvent.deleteMany();
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

  beforeAll(async () => {
    // Finding 3 correction — default clinician resolution is fail-closed
    // and requires an explicit config pointing at a real seeded DOCTOR;
    // set it before app bootstrap so ConfigModule picks it up.
    process.env.PILOT_DEFAULT_CLINICIAN_EMAIL = 'doctor@core04-t11.example.test';

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
      data: { name: 'CORE-04 T11 Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctorPassword = 'Core04T11-Doctor-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor@core04-t11.example.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });
    doctorToken = await login('doctor@core04-t11.example.test', doctorPassword);

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic T11 Patient',
        normalizedFullName: 'synthetic t11 patient',
        dateOfBirth: new Date('1985-01-01'),
        gender: 'MALE',
        phone: '0900000801',
        normalizedPhone: '0900000801',
      },
    });
    patientId = patient.id;
  });

  beforeEach(async()=>{
    const original=await prisma.patient.findUniqueOrThrow({where:{id:patientId}});
    const {id,createdAt,updatedAt,...data}=original;
    patientId=(await prisma.patient.create({data})).id;
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
    delete process.env.PILOT_DEFAULT_CLINICIAN_EMAIL;
  });

  it('a patient with one Episode and one ungrouped Encounter separates them correctly', async () => {
    const episodeRes = await request(app.getHttpServer())
      .post('/care-episodes')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        episodeType: 'HEMORRHOID_TREATMENT',
        startedAt: '2026-01-01T02:00:00.000Z',
      })
      .expect(201);
    const episodeId = episodeRes.body.id as string;
    const treatmentPathwayId = await createLongoPathway(app, doctorToken, episodeId);

    const episodeEncounterRes = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        episodeId,
        treatmentPathwayId,
        occurredAt: '2026-01-05T02:00:00.000Z',
        reasonForVisit: 'Trong đợt điều trị (dữ liệu giả lập)',
        clinicalNote: 'x',
        assessment: 'x',
      })
      .expect(201);

    const ungroupedEncounterRes = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        occurredAt: '2026-01-10T02:00:00.000Z',
        reasonForVisit: 'Ngoài đợt điều trị (dữ liệu giả lập)',
        clinicalNote: 'x',
        assessment: 'x',
      })
      .expect(201);

    const timelineRes = await request(app.getHttpServer())
      .get(`/patients/${patientId}/timeline`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    expect(timelineRes.body.episodes).toHaveLength(1);
    const group = timelineRes.body.episodes[0];
    expect(group.episode.id).toBe(episodeId);
    const groupedEncounterIds = group.events
      .filter((e: { type: string }) => e.type === 'ENCOUNTER')
      .map((e: { data: { id: string } }) => e.data.id);
    expect(groupedEncounterIds).toEqual([episodeEncounterRes.body.id]);

    const ungroupedEncounterIds = timelineRes.body.ungroupedEncounters
      .filter((e: { type: string }) => e.type === 'ENCOUNTER')
      .map((e: { data: { id: string } }) => e.data.id);
    expect(ungroupedEncounterIds).toEqual([ungroupedEncounterRes.body.id]);
  });

  it('sorts Encounters by occurredAt (clinical time), not createdAt (persistence time)', async () => {
    const episodeRes = await request(app.getHttpServer())
      .post('/care-episodes')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        episodeType: 'HEMORRHOID_TREATMENT',
        startedAt: '2026-02-01T02:00:00.000Z',
      })
      .expect(201);
    const episodeId = episodeRes.body.id as string;
    const treatmentPathwayId = await createLongoPathway(app, doctorToken, episodeId);

    // Created in reverse chronological order (later occurredAt created
    // first) — proves sorting genuinely uses occurredAt, not insertion/
    // createdAt order.
    const laterEncounterRes = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        episodeId,
        treatmentPathwayId,
        occurredAt: '2026-02-20T02:00:00.000Z',
        reasonForVisit: 'Sự kiện sau (dữ liệu giả lập)',
        clinicalNote: 'x',
        assessment: 'x',
      })
      .expect(201);

    const earlierEncounterRes = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        episodeId,
        treatmentPathwayId,
        occurredAt: '2026-02-05T02:00:00.000Z',
        reasonForVisit: 'Sự kiện trước (dữ liệu giả lập)',
        clinicalNote: 'x',
        assessment: 'x',
      })
      .expect(201);

    const timelineRes = await request(app.getHttpServer())
      .get(`/patients/${patientId}/timeline`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const group = timelineRes.body.episodes.find(
      (g: { episode: { id: string } }) => g.episode.id === episodeId,
    );
    const orderedIds = group.events
      .filter((e: { type: string }) => e.type === 'ENCOUNTER')
      .map((e: { data: { id: string } }) => e.data.id);
    expect(orderedIds).toEqual([
      earlierEncounterRes.body.id,
      laterEncounterRes.body.id,
    ]);
  });

  it('amendment lineage is preserved — both the original and the amended revision appear as separate events', async () => {
    const episodeRes = await request(app.getHttpServer())
      .post('/care-episodes')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        episodeType: 'HEMORRHOID_TREATMENT',
        startedAt: '2026-03-01T02:00:00.000Z',
      })
      .expect(201);
    const episodeId = episodeRes.body.id as string;
    const treatmentPathwayId = await createLongoPathway(app, doctorToken, episodeId);

    const encounterRes = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientId,
        episodeId,
        treatmentPathwayId,
        occurredAt: '2026-03-05T02:00:00.000Z',
        reasonForVisit: 'Khám tiền phẫu (dữ liệu giả lập)',
        clinicalNote: 'x',
        assessment: 'x',
      })
      .expect(201);

    const submissionRes = await request(app.getHttpServer())
      .post('/clinical-forms')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        encounterId: encounterRes.body.id,
        templateKey: 'LONGO_PREOP_ASSESSMENT',
        responses: { weightKg: 60 },
      })
      .expect(201);
    const submissionId = submissionRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/clinical-forms/${submissionId}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/clinical-forms/${submissionId}/amend`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        responses: { weightKg: 61 },
        amendmentReason: 'Điều chỉnh (dữ liệu giả lập)',
      })
      .expect(201);

    const timelineRes = await request(app.getHttpServer())
      .get(`/patients/${patientId}/timeline`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const group = timelineRes.body.episodes.find(
      (g: { episode: { id: string } }) => g.episode.id === episodeId,
    );
    const formEvents = group.events.filter(
      (e: { type: string }) => e.type === 'CLINICAL_FORM_SUBMITTED',
    );
    expect(formEvents).toHaveLength(2);
    expect(
      formEvents.map((e: { data: { revisionNumber: number } }) => e.data.revisionNumber).sort(),
    ).toEqual([1, 2]);
  });

  it('the Timeline is still read-only — no write verb exists under /patients/:id/timeline', async () => {
    await request(app.getHttpServer())
      .post(`/patients/${patientId}/timeline`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(404);
  });
});
