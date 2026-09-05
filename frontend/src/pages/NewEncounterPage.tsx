import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { encountersApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';

export function NewEncounterPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const episodeId = searchParams.get('episodeId') ?? undefined;
  const treatmentPathwayId = searchParams.get('treatmentPathwayId') ?? undefined;
  const navigate = useNavigate();
  const patientQuery = useApiQuery(() => patientsApi.getById(patientId as string), [patientId]);
  const patientName = patientQuery.data?.fullName;

  const [reasonForVisit, setReasonForVisit] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [clinicalNote, setClinicalNote] = useState('');
  const [assessment, setAssessment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!patientId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const encounter = await encountersApi.create({
        patientId,
        episodeId,
        treatmentPathwayId,
        occurredAt: new Date(occurredAt).toISOString(),
        reasonForVisit,
        clinicalNote,
        assessment,
      });
      // Longo Episode workflow does not use CarePlan/CareTask — return
      // straight to the patient workspace so the doctor can pick a Longo
      // form for this Encounter. A general (non-episode) Encounter keeps
      // the existing CarePlan creation flow.
      if (episodeId) {
        navigate(`/patients/${patientId}`);
      } else {
        navigate(`/patients/${patientId}/care-plan/new?encounterId=${encounter.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được lượt khám.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="form-page">
      <PageHeader
        parentLabel="Hồ sơ bệnh nhân"
        parentHref={`/patients/${patientId}`}
        title="Lượt khám mới"
        subtitle={patientName}
      />
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="occurredAt">Thời điểm khám</label>
        <input
          id="occurredAt"
          type="datetime-local"
          required
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />

        <label htmlFor="reasonForVisit">Lý do khám</label>
        <input
          id="reasonForVisit"
          required
          value={reasonForVisit}
          onChange={(e) => setReasonForVisit(e.target.value)}
        />

        <label htmlFor="clinicalNote">Ghi chú lâm sàng</label>
        <textarea
          id="clinicalNote"
          required
          rows={4}
          value={clinicalNote}
          onChange={(e) => setClinicalNote(e.target.value)}
        />

        <label htmlFor="assessment">Đánh giá</label>
        <textarea
          id="assessment"
          required
          rows={3}
          value={assessment}
          onChange={(e) => setAssessment(e.target.value)}
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(`/patients/${patientId}`)}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Đang lưu...' : 'Lưu và tạo kế hoạch chăm sóc'}
          </button>
        </div>
      </form>
    </div>
  );
}
