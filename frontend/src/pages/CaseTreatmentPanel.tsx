import { useState } from 'react';
import { Link } from 'react-router-dom';
import { treatmentPathwaysApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import type { TreatmentPathway } from '../types/domain';
import { formatDateTime } from '../lib/format';
const methods = ['LONGO', 'MILLIGAN_MORGAN', 'FERGUSON', 'HCPT', 'LASER_DIODE_LHP', 'THD_HAL_RAR'];
export function CaseTreatmentPanel({
  caseId,
  patientId,
  active,
  onChanged,
}: {
  caseId: string;
  patientId: string;
  active: boolean;
  onChanged: () => void;
}) {
  const query = useApiQuery(() => treatmentPathwaysApi.list(caseId), [caseId]);
  const [modality, setModality] = useState<TreatmentPathway['modality']>('SURGERY');
  const [methodCode, setMethodCode] = useState('LONGO');
  const [startedAt, setStartedAt] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      await treatmentPathwaysApi.create({
        caseId,
        modality,
        ...(modality === 'SURGERY' ? { methodCode } : {}),
        startedAt: new Date(startedAt).toISOString(),
      });
      query.reload();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được phương thức điều trị');
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <h4>Phương thức điều trị trong Case</h4>
      {query.isLoading && <LoadingState />}
      {(error || query.error) && <ErrorState message={error || query.error!} />}
      {(query.data ?? []).map((p, i) => (
        <div className="inline-form" key={p.id} data-testid="treatment-pathway">
          <strong>
            {p.modality} {p.methodCode ?? ''} · #{i + 1}
          </strong>{' '}
          — {formatDateTime(p.startedAt)}
          {p.legacyEpisodeId && <p>Chuyển từ đợt Longo lịch sử · giữ nguyên dữ liệu</p>}
          {active && (
            <Link
              className="btn btn-ghost"
              to={`/patients/${patientId}/encounters/new?episodeId=${caseId}&treatmentPathwayId=${p.id}`}
            >
              + Lượt khám trong phương thức điều trị #{i + 1}
            </Link>
          )}
        </div>
      ))}
      {active && (
        <form onSubmit={create} className="inline-form">
          <label htmlFor={`modality-${caseId}`}>Phương thức điều trị</label>
          <select
            id={`modality-${caseId}`}
            value={modality}
            onChange={(e) => setModality(e.target.value as TreatmentPathway['modality'])}
          >
            <option value="MEDICAL">Nội khoa</option>
            <option value="PROCEDURE">Thủ thuật</option>
            <option value="SURGERY">Phẫu thuật</option>
          </select>
          {modality === 'SURGERY' && (
            <>
              <label htmlFor={`method-${caseId}`}>Phương pháp phẫu thuật</label>
              <select
                id={`method-${caseId}`}
                value={methodCode}
                onChange={(e) => setMethodCode(e.target.value)}
              >
                {methods.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <p className="form-hint">
                Phẫu thuật tại bệnh viện. LONGO được gửi tường minh khi chọn.
              </p>
            </>
          )}
          <label htmlFor={`path-start-${caseId}`}>Thời điểm bắt đầu phương thức</label>
          <input
            id={`path-start-${caseId}`}
            type="datetime-local"
            required
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
          />
          <button className="btn btn-primary" disabled={pending} type="submit">
            Thêm phương thức điều trị
          </button>
          <p className="form-hint">
            Quyết định điều trị không tự tạo phương thức hay xác nhận đã thực hiện phẫu thuật.
          </p>
        </form>
      )}
    </section>
  );
}
