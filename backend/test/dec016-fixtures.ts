import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
/** Explicit prospective fixture: callers name the Case and send LONGO.
 * No production default, legacy-data inference or patient matching. */
export async function createLongoPathway(
  app: INestApplication,
  token: string,
  caseId: string,
  startedAt = '2026-01-01T00:00:00.000Z',
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/treatment-pathways')
    .auth(token, { type: 'bearer' })
    .send({ caseId, modality: 'SURGERY', methodCode: 'LONGO', startedAt })
    .expect(201);
  return res.body.id;
}
/** Adds explicit v2 modality to former v1 positive fixture snapshots only.
 * Empty/invalid negative payloads are intentionally not repaired. */
export function decisionFixture(
  templateKey: string,
  responses: Record<string, unknown>,
) {
  return templateKey === 'HEMORRHOID_TREATMENT_DECISION' &&
    typeof responses.decisionSummary === 'string' &&
    responses.decisionSummary.length
    ? { treatmentModalities: ['SURGERY'], ...responses }
    : responses;
}
