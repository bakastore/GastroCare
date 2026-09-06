import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * DEC-021 R9 finding 1 — a Return Encounter never creates/reopens a
 * HEMORRHOID_TREATMENT CareEpisode; the episode is established only by
 * Structured Treatment Activation (`POST /encounters/:id/hemorrhoid-treatment/
 * activate`) from a completed Treatment Decision v3 (ACCEPTED + non-empty
 * effectiveModalities). Pre-DEC-021 Slice-3 specs relied on "first Return
 * starts the episode"; this shared helper injects the now-required
 * activation step so those continuous-care loops still exercise real
 * behaviour.
 *
 * Given a started (IN_PROGRESS) Initial-branch Encounter that already has a
 * COMPLETED HEMORRHOID_EXAMINATION + HEMORRHOID_DIAGNOSIS, it creates +
 * completes a v3 decision and activates treatment, returning the ACTIVE
 * episode id. If the Encounter is only REGISTERED it is started first.
 */
export async function activateHemorrhoidTreatment(
  app: INestApplication,
  token: string,
  encounterId: string,
  opts: { effectiveModalities?: string[] } = {},
): Promise<{ episodeId: string }> {
  const auth = { Authorization: `Bearer ${token}` };
  const enc = await request(app.getHttpServer())
    .get(`/encounters/${encounterId}`)
    .set(auth);
  if (enc.body?.clinicalStatus === 'REGISTERED') {
    await request(app.getHttpServer())
      .post(`/encounters/${encounterId}/start`)
      .set(auth)
      .expect(201);
  }

  const effective = opts.effectiveModalities ?? ['MEDICAL'];
  const responses: Record<string, unknown> = {
    proposedModalities: effective,
    patientDecision: 'ACCEPTED',
    effectiveModalities: effective,
    decisionSummary: 'Diễn giải quyết định (synthetic, DEC-021)',
  };
  if (effective.includes('MEDICAL')) responses.medicalCareSetting = 'Phòng khám';
  if (effective.includes('PROCEDURE'))
    responses.procedureCareSetting = 'Phòng thủ thuật';
  if (effective.includes('SURGERY')) responses.surgeryCareSetting = 'HOSPITAL';

  const decision = await request(app.getHttpServer())
    .post('/clinical-forms')
    .set(auth)
    .send({
      encounterId,
      templateKey: 'HEMORRHOID_TREATMENT_DECISION',
      templateVersion: 3,
      responses,
    })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/clinical-forms/${decision.body.id}/complete`)
    .set(auth)
    .expect(201);

  const activated = await request(app.getHttpServer())
    .post(`/encounters/${encounterId}/hemorrhoid-treatment/activate`)
    .set(auth)
    .send({ sourceDecisionSubmissionId: decision.body.id })
    .expect(201);
  return { episodeId: activated.body.episode.id as string };
}
