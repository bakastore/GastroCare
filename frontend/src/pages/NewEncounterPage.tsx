import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { encountersApi } from '../api/resources';
import { ApiError } from '../api/client';

export function NewEncounterPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const [reasonForVisit, setReasonForVisit] = useState('');
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
        reasonForVisit,
        clinicalNote,
        assessment,
      });
      navigate(`/patients/${patientId}/care-plan/new?encounterId=${encounter.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được lượt khám.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="form-page">
      <h1>Lượt khám mới</h1>
      <form onSubmit={handleSubmit} noValidate>
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
