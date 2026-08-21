import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { carePlansApi } from '../api/resources';
import { ApiError } from '../api/client';

export function NewCarePlanPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [searchParams] = useSearchParams();
  const encounterId = searchParams.get('encounterId');
  const navigate = useNavigate();

  const [instructions, setInstructions] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!encounterId) {
    return <p className="form-error">Thiếu thông tin lượt khám.</p>;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const carePlan = await carePlansApi.create({
        encounterId: encounterId as string,
        instructions,
        followUpDate: followUpDate || undefined,
      });
      navigate(`/care-plans/${carePlan.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được kế hoạch chăm sóc.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="form-page">
      <h1>Kế hoạch chăm sóc</h1>
      <p className="page-subtitle">Đã lưu lượt khám. Nhập kế hoạch điều trị / dặn dò.</p>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="instructions">Điều trị / dặn dò</label>
        <textarea
          id="instructions"
          required
          rows={5}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />

        <label htmlFor="followUpDate">Ngày tái khám (tùy chọn)</label>
        <input
          id="followUpDate"
          type="date"
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
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
            {isSubmitting ? 'Đang lưu...' : 'Lưu bản nháp'}
          </button>
        </div>
      </form>
    </div>
  );
}
