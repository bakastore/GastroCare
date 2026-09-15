import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clinicalFormsApi, encountersApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime } from '../lib/format';

/**
 * DEC-021 R9 finding 4 — minimum usable UI for the NR-03 / NR-04 / §3
 * Encounter-scoped actions, for Owner synthetic acceptance. No redesign:
 * one focused page that calls the existing endpoints.
 *   - Start Encounter (REGISTERED -> IN_PROGRESS)
 *   - Structured Treatment Activation (from a completed Treatment Decision v3)
 *   - Accept handover (receiving Doctor)
 *   - End Encounter (IN_PROGRESS -> COMPLETED)
 */
export function EncounterActionsPage() {
  const { patientId, encounterId } = useParams<{
    patientId: string;
    encounterId: string;
  }>();
  const navigate = useNavigate();
  const v3FormHref = `/patients/${patientId}/encounters/${encounterId}/longo-forms/HEMORRHOID_TREATMENT_DECISION?version=3`;

  const encounterQuery = useApiQuery(
    () => encountersApi.getById(encounterId as string),
    [encounterId],
  );
  const submissionsQuery = useApiQuery(
    () => clinicalFormsApi.listByPatient(patientId as string),
    [patientId],
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (encounterQuery.isLoading) return <LoadingState />;
  if (encounterQuery.error) return <ErrorState message={encounterQuery.error} />;
  const encounter = encounterQuery.data;
  if (!encounter) return null;

  const status = encounter.clinicalStatus ?? null;

  // The completed Treatment Decision v3 on this Encounter is the machine-
  // checkable activation source (DEC-021 §3.2). The list is a chain, so pick
  // the highest-revision COMPLETED head.
  const v3Decisions = (submissionsQuery.data ?? [])
    .filter(
      (s) =>
        s.encounterId === encounter.id &&
        s.templateKey === 'HEMORRHOID_TREATMENT_DECISION' &&
        s.templateVersion >= 3 &&
        s.status === 'COMPLETED',
    )
    .sort((a, b) => b.revisionNumber - a.revisionNumber);
  const activationSource = v3Decisions[0] ?? null;

  async function run(label: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(ok);
      encounterQuery.reload();
      submissionsQuery.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Thao tác thất bại.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        parentLabel="Hồ sơ bệnh nhân"
        parentHref={`/patients/${patientId}`}
        title="Vòng đời lượt khám & bàn giao"
      />

      <dl className="identity-summary">
        <dt>Trạng thái lâm sàng</dt>
        <dd>{status ?? 'Chưa xác định (dữ liệu cũ)'}</dd>
        <dt>Bắt đầu khám</dt>
        <dd>
          {encounter.clinicalStartedAt
            ? formatDateTime(encounter.clinicalStartedAt)
            : '—'}
        </dd>
        <dt>Kết thúc khám</dt>
        <dd>
          {encounter.clinicalEndedAt
            ? formatDateTime(encounter.clinicalEndedAt)
            : '—'}
        </dd>
        <dt>Điều trị đã kích hoạt</dt>
        <dd>
          {encounter.treatmentActivatedAt
            ? formatDateTime(encounter.treatmentActivatedAt)
            : 'Chưa'}
        </dd>
      </dl>

      {notice && <p className="form-hint">{notice}</p>}
      {error && <ErrorState message={error} />}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy !== null || status !== 'REGISTERED'}
          onClick={() =>
            run(
              'start',
              () => encountersApi.start(encounter.id),
              'Đã bắt đầu khám.',
            )
          }
        >
          Bắt đầu khám
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          disabled={
            busy !== null ||
            status !== 'IN_PROGRESS' ||
            !!encounter.treatmentActivationSubmissionId
          }
          onClick={() => navigate(v3FormHref)}
        >
          {activationSource
            ? 'Sửa phiếu Quyết định điều trị v3'
            : 'Mở phiếu Quyết định điều trị v3'}
        </button>

        <button
          type="button"
          className="btn btn-primary"
          disabled={
            busy !== null ||
            status !== 'IN_PROGRESS' ||
            !!encounter.treatmentActivationSubmissionId ||
            !activationSource
          }
          title={
            !activationSource
              ? 'Cần một phiếu Quyết định điều trị v3 đã hoàn tất (ACCEPTED + phương thức điều trị)'
              : undefined
          }
          onClick={() =>
            activationSource &&
            run(
              'activate',
              () =>
                encountersApi.activateHemorrhoidTreatment(encounter.id, {
                  sourceDecisionSubmissionId: activationSource.id,
                }),
              'Đã kích hoạt điều trị bệnh trĩ.',
            )
          }
        >
          Kích hoạt điều trị bệnh trĩ
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy !== null || status !== 'IN_PROGRESS'}
          onClick={() =>
            run(
              'accept',
              () => encountersApi.acceptHandover(encounter.id),
              'Đã nhận bàn giao.',
            )
          }
        >
          Nhận bàn giao
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy !== null || status !== 'IN_PROGRESS'}
          onClick={() =>
            run(
              'end',
              () => encountersApi.end(encounter.id),
              'Đã kết thúc khám.',
            )
          }
        >
          Kết thúc khám
        </button>
      </div>
    </div>
  );
}
