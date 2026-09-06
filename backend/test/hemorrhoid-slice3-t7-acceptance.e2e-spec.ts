import { decisionFixture } from './dec016-fixtures';
import { activateHemorrhoidTreatment } from './dec021-activation-helper';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthRole, CareEpisodeStatus, CareTaskStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Hemorrhoid Vertical Slice 3 — T7 TARGETED SYNTHETIC ACCEPTANCE (e2e),
 * DEC-013 OWNER LOCKED, docs/12_HEMORRHOID_SLICE3_IMPLEMENTATION_CONTRACT.md.
 *
 * This is NOT another unit-level regression pass over T1-T6 (those already
 * exist in hemorrhoid-slice3-t1/t2/t3/t4/t5.e2e-spec.ts). This file runs the
 * full continuous-care loop as ONE continuous synthetic clinical scenario
 * end-to-end (mirroring hemorrhoid-slice2-t7-acceptance.e2e-spec.ts's
 * pattern for Slice 2), plus the small number of negative acceptance cases
 * that are not already exercised by an existing T1-T6 spec. Negative cases
 * already proven elsewhere are deliberately NOT duplicated here — see the
 * "REUSED FROM" comment on each item in the T7 report.
 */
describe('Hemorrhoid Vertical Slice 3 — T7 targeted synthetic acceptance (e2e)', () => {
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
    reasonForVisit = 'Khám trĩ (T7, synthetic)',
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/encounters')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientId: patient,
        occurredAt: new Date().toISOString(),
        reasonForVisit,
        workflowKind: 'HEMORRHOID_INITIAL',
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

  async function createReturn(token: string, careTaskId: string) {
    return request(app.getHttpServer())
      .post('/encounters/hemorrhoid-return')
      .set('Authorization', `Bearer ${token}`)
      .send({
        careTaskId,
        occurredAt: new Date().toISOString(),
        reasonForVisit: 'Tái khám (T7, synthetic)',
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
      data: { name: 'Hemorrhoid Slice3 T7 Synthetic Tenant' },
    });
    tenantId = tenant.id;

    const doctorPassword = 'Slice3-T7-DoctorA-Pass1!';
    await prisma.authUser.create({
      data: {
        email: 'doctor-t7-slice3@gastrocare.test',
        passwordHash: await bcrypt.hash(doctorPassword, 10),
        role: AuthRole.DOCTOR,
        tenantId,
      },
    });

    const patient = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Hemorrhoid Slice3 T7 Patient',
        normalizedFullName: 'synthetic hemorrhoid slice3 t7 patient',
        dateOfBirth: new Date('1965-07-07'),
        gender: 'MALE',
        phone: 'T7-SLICE3-SYNTH-PATIENT-01',
        normalizedPhone: 'T7-SLICE3-SYNTH-PATIENT-01',
      },
    });
    patientId = patient.id;

    const patient2 = await prisma.patient.create({
      data: {
        tenantId,
        fullName: 'Synthetic Hemorrhoid Slice3 T7 Patient Two',
        normalizedFullName: 'synthetic hemorrhoid slice3 t7 patient two',
        dateOfBirth: new Date('1963-08-08'),
        gender: 'FEMALE',
        phone: 'T7-SLICE3-SYNTH-PATIENT-02',
        normalizedPhone: 'T7-SLICE3-SYNTH-PATIENT-02',
      },
    });
    patient2Id = patient2.id;

    doctorToken = await login('doctor-t7-slice3@gastrocare.test', doctorPassword);
  });

  afterAll(async () => {
    await resetTables();
    await app.close();
  });

  it('runs the full continuous-care loop as one continuous synthetic scenario end-to-end', async () => {
    // 1. Initial Encounter, remains ungrouped.
    const initialEncounterId = await createEncounter(doctorToken, patientId);
    const initialEncounterBefore = await prisma.encounter.findUniqueOrThrow({
      where: { id: initialEncounterId },
    });
    // DEC-020 D20-02: the Initial Hemorrhoid Encounter is ungrouped.
    expect(initialEncounterBefore.episodeId).toBeNull();

    // 2. Examination -> Diagnosis -> initial Treatment Decision.
    const exam = await createSubmission(
      doctorToken,
      initialEncounterId,
      'HEMORRHOID_EXAMINATION',
      {},
    );
    expect(exam.status).toBe(201);
    await completeSubmission(doctorToken, exam.body.id);

    const diagnosis = await createSubmission(
      doctorToken,
      initialEncounterId,
      'HEMORRHOID_DIAGNOSIS',
      { diagnosisSummary: 'Trĩ nội độ II (T7 golden path, synthetic)' },
    );
    expect(diagnosis.status).toBe(201);
    const diagnosisId = diagnosis.body.id as string;
    await completeSubmission(doctorToken, diagnosisId);

    // DEC-021 R9 finding 1 — the HEMORRHOID_TREATMENT episode is established
    // by Structured Treatment Activation from a completed Treatment Decision
    // v3 (ACCEPTED + effectiveModalities), NOT by the first Return. The
    // Initial Encounter now owns the ACTIVE episode.
    const { episodeId: activatedEpisodeId } = await activateHemorrhoidTreatment(
      app,
      doctorToken,
      initialEncounterId,
    );

    // 3. CarePlan #1 -> sign -> OPEN follow-up task.
    const carePlan1 = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        encounterId: initialEncounterId,
        instructions: 'Tái khám theo lịch (T7 golden path, synthetic)',
        followUpDate: '2026-11-01',
      });
    expect(carePlan1.status).toBe(201);
    const signed1 = await request(app.getHttpServer())
      .post(`/care-plans/${carePlan1.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(signed1.status).toBe(201);
    const task1Id = signed1.body.careTask.id as string;

    // 4. First Return Encounter -> reuses the already-ACTIVE episode from
    // activation -> task1 COMPLETED + linked.
    const return1 = await createReturn(doctorToken, task1Id);
    expect(return1.status).toBe(201);
    const episodeId = return1.body.episodeId as string;
    expect(episodeId).toBe(activatedEpisodeId);

    const activeEpisodes = await prisma.careEpisode.findMany({
      where: {
        tenantId,
        patientId,
        episodeType: 'HEMORRHOID_TREATMENT',
        status: CareEpisodeStatus.ACTIVE,
      },
    });
    expect(activeEpisodes).toHaveLength(1);
    expect(activeEpisodes[0].id).toBe(episodeId);

    const initialEncounterAfter = await prisma.encounter.findUniqueOrThrow({
      where: { id: initialEncounterId },
    });
    // DEC-021 §5.6 Scenario B — the Initial Encounter that activated
    // treatment now OWNS the ACTIVE episode (D20-02 supersession).
    expect(initialEncounterAfter.episodeId).toBe(episodeId);

    const task1After = await prisma.careTask.findUniqueOrThrow({
      where: { id: task1Id },
    });
    expect(task1After.status).toBe(CareTaskStatus.COMPLETED);
    expect(task1After.completedByEncounterId).toBe(return1.body.id);

    // 5. HEMORRHOID_FOLLOW_UP_ASSESSMENT -> HEMORRHOID_NEXT_CLINICAL_DECISION
    // -> CarePlan #2 (new CarePlan, anchored to the Return Encounter) ->
    // sign -> next follow-up task.
    const assessment1 = await createSubmission(
      doctorToken,
      return1.body.id,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'Cải thiện một phần (T7 golden path, synthetic)' },
    );
    expect(assessment1.status).toBe(201);
    await completeSubmission(doctorToken, assessment1.body.id);

    const nextDecision1 = await createSubmission(
      doctorToken,
      return1.body.id,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'Tiếp tục theo dõi (T7 golden path, synthetic)' },
    );
    expect(nextDecision1.status).toBe(201);
    await completeSubmission(doctorToken, nextDecision1.body.id);

    const carePlan2 = await request(app.getHttpServer())
      .post('/care-plans')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        encounterId: return1.body.id,
        instructions: 'Kế hoạch #2 (T7 golden path, synthetic)',
        followUpDate: '2026-12-01',
      });
    expect(carePlan2.status).toBe(201);
    expect(carePlan2.body.id).not.toBe(carePlan1.body.id);
    expect(carePlan2.body.encounterId).toBe(return1.body.id);
    const signed2 = await request(app.getHttpServer())
      .post(`/care-plans/${carePlan2.body.id}/sign`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(signed2.status).toBe(201);
    const task2Id = signed2.body.careTask.id as string;

    // 6. Second Return Encounter -> same ACTIVE episode reused.
    const return2 = await createReturn(doctorToken, task2Id);
    expect(return2.status).toBe(201);
    expect(return2.body.episodeId).toBe(episodeId);

    const episodeCountAfterReturn2 = await prisma.careEpisode.count({
      where: { tenantId, patientId, episodeType: 'HEMORRHOID_TREATMENT' },
    });
    expect(episodeCountAfterReturn2).toBe(1);

    // 7. Repeat Assessment / Next Decision on the second Return Encounter —
    // no new CarePlan this cycle (Contract §F: optional), proving the loop
    // does not force a CarePlan on every cycle.
    const assessment2 = await createSubmission(
      doctorToken,
      return2.body.id,
      'HEMORRHOID_FOLLOW_UP_ASSESSMENT',
      { responseSummary: 'Ổn định (T7 golden path, synthetic)' },
    );
    expect(assessment2.status).toBe(201);
    await completeSubmission(doctorToken, assessment2.body.id);

    const nextDecision2 = await createSubmission(
      doctorToken,
      return2.body.id,
      'HEMORRHOID_NEXT_CLINICAL_DECISION',
      { decisionSummary: 'Ngừng theo dõi (T7 golden path, synthetic)' },
    );
    expect(nextDecision2.status).toBe(201);
    await completeSubmission(doctorToken, nextDecision2.body.id);

    // 8. Explicit CareEpisode close (at least one COMPLETED Follow-up
    // Assessment exists on an Encounter in the episode — satisfied twice
    // over here).
    const closeRes = await request(app.getHttpServer())
      .post(`/care-episodes/${episodeId}/close`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(closeRes.status).toBe(201);
    expect(closeRes.body.status).toBe(CareEpisodeStatus.CLOSED);

    // 9. Timeline: initial history ungrouped; continuous-care Return
    // history grouped under the (now CLOSED) Hemorrhoid episode.
    const timelineRes = await request(app.getHttpServer())
      .get(`/patients/${patientId}/timeline`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const ungrouped = timelineRes.body.ungroupedEncounters as {
      type: string;
      data: Record<string, unknown>;
    }[];
    // DEC-021 §5.6 Scenario B — the Initial Encounter activated treatment, so
    // it is now grouped under the Hemorrhoid episode, not ungrouped.
    expect(
      ungrouped.some((e) => e.type === 'ENCOUNTER' && e.data.id === initialEncounterId),
    ).toBe(false);

    const episodeGroup = timelineRes.body.episodes.find(
      (g: { episode: { id: string } }) => g.episode.id === episodeId,
    );
    expect(episodeGroup).toBeTruthy();
    expect(episodeGroup.episode.episodeType).toBe('HEMORRHOID_TREATMENT');
    expect(
      (episodeGroup.events as { type: string; data: Record<string, unknown> }[]).some(
        (e) => e.type === 'ENCOUNTER' && e.data.id === initialEncounterId,
      ),
    ).toBe(true);
    expect(episodeGroup.episode.status).toBe(CareEpisodeStatus.CLOSED);
    const episodeEvents = episodeGroup.events as {
      type: string;
      data: Record<string, unknown>;
    }[];
    expect(
      episodeEvents.some((e) => e.type === 'ENCOUNTER' && e.data.id === return1.body.id),
    ).toBe(true);
    expect(
      episodeEvents.some((e) => e.type === 'ENCOUNTER' && e.data.id === return2.body.id),
    ).toBe(true);
    const assessment2Event = episodeEvents.find(
      (e) =>
        e.type === 'CLINICAL_FORM_SUBMITTED' &&
        e.data.templateKey === 'HEMORRHOID_FOLLOW_UP_ASSESSMENT' &&
        e.data.encounterId === return2.body.id,
    );
    expect(assessment2Event?.data.summary).toBe('Ổn định (T7 golden path, synthetic)');
    const nextDecision2Event = episodeEvents.find(
      (e) =>
        e.type === 'CLINICAL_FORM_SUBMITTED' &&
        e.data.templateKey === 'HEMORRHOID_NEXT_CLINICAL_DECISION' &&
        e.data.encounterId === return2.body.id,
    );
    expect(nextDecision2Event?.data.summary).toBe('Ngừng theo dõi (T7 golden path, synthetic)');

    // 10. Completed form/amendment history remains immutable — amend the
    // initial Diagnosis and prove the original revision is preserved (same
    // append-only invariant proven for Slice 2, re-confirmed here for the
    // Slice 3 continuous-care loop's own new templates via the Follow-up
    // Assessment on Return #1).
    const diagnosisAmended = await request(app.getHttpServer())
      .post(`/clinical-forms/${diagnosisId}/amend`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        responses: {
          diagnosisSummary: 'Trĩ nội độ III (đã sửa, T7 golden path, synthetic)',
        },
        amendmentReason: 'Đánh giá lại (T7 golden path, synthetic)',
      });
    expect(diagnosisAmended.status).toBe(201);
    expect(diagnosisAmended.body.revisionNumber).toBe(2);
    const diagnosisHistory = await request(app.getHttpServer())
      .get(`/clinical-forms/${diagnosisId}/history`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    expect(diagnosisHistory.body.revisions).toHaveLength(2);
    expect(diagnosisHistory.body.revisions[0].responses.diagnosisSummary).toBe(
      'Trĩ nội độ II (T7 golden path, synthetic)',
    );

    const assessment1Amended = await request(app.getHttpServer())
      .post(`/clinical-forms/${assessment1.body.id}/amend`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        responses: { responseSummary: 'Cải thiện tốt hơn dự kiến (đã sửa, synthetic)' },
        amendmentReason: 'Đánh giá lại (T7 golden path, synthetic)',
      });
    expect(assessment1Amended.status).toBe(201);
    const assessment1History = await request(app.getHttpServer())
      .get(`/clinical-forms/${assessment1.body.id}/history`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    expect(assessment1History.body.revisions).toHaveLength(2);
    expect(assessment1History.body.revisions[0].responses.responseSummary).toBe(
      'Cải thiện một phần (T7 golden path, synthetic)',
    );

    // 11. Deferred Procedure/Surgery/Investigation/CORE-05/AI scope remains
    // absent throughout the continuous-care loop.
    for (const path of ['/procedures', '/surgeries', '/investigations', '/case-intelligence']) {
      const res = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(404);
    }
  });

  // ==========================================================================
  // Negative acceptance cases NOT already covered by an existing T1-T6 spec.
  // ==========================================================================
  describe('negative acceptance — not already covered by T1-T6', () => {
    it('there is no Encounter PATCH endpoint at all — no episodeId PATCH/backfill is possible', async () => {
      const encounterId = await createEncounter(doctorToken, patientId);
      const res = await request(app.getHttpServer())
        .patch(`/encounters/${encounterId}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ episodeId: 'attacker-supplied-episode-id' });
      expect(res.status).toBe(404);
    });

    it('rejects a cross-tenant CareTask id on the dedicated Return Encounter endpoint (404, no cross-tenant leak)', async () => {
      const otherTenant = await prisma.tenant.create({
        data: { name: 'Hemorrhoid Slice3 T7 Other Tenant' },
      });
      const otherPatient = await prisma.patient.create({
        data: {
          tenantId: otherTenant.id,
          fullName: 'Other Tenant Patient',
          normalizedFullName: 'other tenant patient',
          dateOfBirth: new Date('1980-01-01'),
          gender: 'MALE',
          phone: 'OTHER-TENANT-PATIENT-01',
          normalizedPhone: 'OTHER-TENANT-PATIENT-01',
        },
      });
      const otherPlan = await prisma.carePlan.create({
        data: {
          tenantId: otherTenant.id,
          patientId: otherPatient.id,
          encounterId: (
            await prisma.encounter.create({
              data: {
                tenantId: otherTenant.id,
                patientId: otherPatient.id,
                responsibleClinicianId: (
                  await prisma.authUser.findFirstOrThrow({
                    where: { tenantId },
                  })
                ).id,
                createdByUserId: (
                  await prisma.authUser.findFirstOrThrow({
                    where: { tenantId },
                  })
                ).id,
                reasonForVisit: 'x',
                occurredAt: new Date(),
              },
            })
          ).id,
          instructions: 'x',
          status: 'SIGNED',
        },
      });
      const otherTask = await prisma.careTask.create({
        data: {
          tenantId: otherTenant.id,
          patientId: otherPatient.id,
          carePlanId: otherPlan.id,
          dueDate: new Date(),
        },
      });

      const res = await createReturn(doctorToken, otherTask.id);
      expect(res.status).toBe(404);
    });
  });
});
