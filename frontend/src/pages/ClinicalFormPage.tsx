import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clinicalFormsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import type { ClinicalFormSubmission } from '../types/domain';

// HEMORRHOID_LONGO_FOLLOWUP v1 — field labels/options mirror
// backend/src/clinical-forms/templates/hemorrhoid-longo-followup.v1.ts
// exactly. Templates are code-configuration (Owner Execution Contract
// section 31: no generic low-code form builder), so this page is a direct,
// hand-written rendering of that one template rather than a schema-driven
// renderer.
const TEMPLATE_KEY = 'HEMORRHOID_LONGO_FOLLOWUP';

const WEXNER_OPTIONS = [
  { value: 0, label: 'Không bao giờ' },
  { value: 1, label: 'Hiếm khi (<1 lần/tháng)' },
  { value: 2, label: 'Thỉnh thoảng (<1 lần/tuần, ≥1 lần/tháng)' },
  { value: 3, label: 'Hàng tuần (<1 lần/ngày, ≥1 lần/tuần)' },
  { value: 4, label: 'Hàng ngày (≥1 lần/ngày)' },
];

const WEXNER_ITEMS: { key: string; label: string }[] = [
  { key: 'wexnerSolidStool', label: 'Đại tiện không tự chủ với phân rắn' },
  { key: 'wexnerLiquidStool', label: 'Đại tiện không tự chủ với phân lỏng' },
  { key: 'wexnerGas', label: 'Không tự chủ với hơi' },
  { key: 'wexnerPadWearing', label: 'Phải mang băng vệ sinh/tã' },
  { key: 'wexnerLifestyleAlteration', label: 'Thay đổi lối sống do rối loạn tự chủ' },
];

type Responses = Record<string, number | string>;

export function ClinicalFormPage() {
  const { patientId, encounterId } = useParams<{
    patientId: string;
    encounterId: string;
  }>();

  const submissionQuery = useApiQuery(async () => {
    const submissions = await clinicalFormsApi.listByPatient(patientId as string);
    return (
      submissions.find(
        (s) => s.encounterId === encounterId && s.templateKey === TEMPLATE_KEY,
      ) ?? null
    );
  }, [patientId, encounterId]);

  if (submissionQuery.isLoading) return <LoadingState />;
  if (submissionQuery.error) return <ErrorState message={submissionQuery.error} />;

  if (!submissionQuery.data) {
    return (
      <StartForm
        encounterId={encounterId as string}
        patientId={patientId as string}
        onCreated={submissionQuery.reload}
      />
    );
  }

  return (
    <FormEditor
      submission={submissionQuery.data}
      patientId={patientId as string}
      onChanged={submissionQuery.reload}
    />
  );
}

function StartForm({
  encounterId,
  patientId,
  onCreated,
}: {
  encounterId: string;
  patientId: string;
  onCreated: () => void;
}) {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setIsCreating(true);
    try {
      await clinicalFormsApi.create({
        encounterId,
        templateKey: TEMPLATE_KEY,
        responses: {},
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được phiếu khám lại.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="form-page">
      <h1>Khám lại sau phẫu thuật Longo (trĩ)</h1>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(`/patients/${patientId}`)}>
          Hủy
        </button>
        <button type="button" className="btn btn-primary" disabled={isCreating} onClick={start}>
          {isCreating ? 'Đang tạo...' : 'Bắt đầu phiếu khám lại'}
        </button>
      </div>
    </div>
  );
}

function FormEditor({
  submission,
  patientId,
  onChanged,
}: {
  submission: ClinicalFormSubmission;
  patientId: string;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const isReadOnly = submission.status === 'COMPLETED';
  const [responses, setResponses] = useState<Responses>(submission.responses);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const liveWexnerTotal = useMemo(() => {
    const values = WEXNER_ITEMS.map((item) => responses[item.key]);
    if (values.some((v) => typeof v !== 'number')) return null;
    return (values as number[]).reduce((sum, v) => sum + v, 0);
  }, [responses]);

  function setField(key: string, value: number | string) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  async function saveDraft() {
    setError(null);
    setIsSaving(true);
    try {
      await clinicalFormsApi.updateDraft(submission.id, { responses });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được bản nháp.');
    } finally {
      setIsSaving(false);
    }
  }

  async function completeForm() {
    setError(null);
    setIsCompleting(true);
    try {
      // Completion validates/scores whatever is currently persisted as the
      // DRAFT's responses on the server — persist the in-editor values first
      // so "Hoàn tất" always acts on what the doctor just filled in, not a
      // stale (possibly empty) prior save.
      await clinicalFormsApi.updateDraft(submission.id, { responses });
      await clinicalFormsApi.complete(submission.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không hoàn tất được phiếu khám lại.');
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <div className="form-page">
      <h1>Khám lại sau phẫu thuật Longo (trĩ)</h1>
      <p className="page-subtitle">
        Trạng thái:{' '}
        {submission.status === 'DRAFT' ? (
          <span className="badge badge-draft">Nháp</span>
        ) : (
          <span className="badge badge-signed">Đã hoàn tất</span>
        )}
      </p>

      <section>
        <h2>Thông tin lần khám lại</h2>
        <label htmlFor="visitNumber">Lần khám lại thứ</label>
        <input
          id="visitNumber"
          type="number"
          min={1}
          max={20}
          disabled={isReadOnly}
          value={responses.visitNumber ?? ''}
          onChange={(e) => setField('visitNumber', Number(e.target.value))}
        />

        <label htmlFor="monthsPostOp">Số tháng sau phẫu thuật</label>
        <input
          id="monthsPostOp"
          type="number"
          min={0}
          max={120}
          disabled={isReadOnly}
          value={responses.monthsPostOp ?? ''}
          onChange={(e) => setField('monthsPostOp', Number(e.target.value))}
        />
      </section>

      <section>
        <h2>Đánh giá đau</h2>
        <label htmlFor="vasPain">Đau (thang điểm VAS, 0-10)</label>
        <input
          id="vasPain"
          type="number"
          min={0}
          max={10}
          disabled={isReadOnly}
          value={responses.vasPain ?? ''}
          onChange={(e) => setField('vasPain', Number(e.target.value))}
        />
      </section>

      <section>
        <h2>Đánh giá khả năng tự chủ hậu môn (thang điểm Wexner)</h2>
        {WEXNER_ITEMS.map((item) => (
          <div key={item.key}>
            <label htmlFor={item.key}>{item.label}</label>
            <select
              id={item.key}
              disabled={isReadOnly}
              value={responses[item.key] ?? ''}
              onChange={(e) => setField(item.key, Number(e.target.value))}
            >
              <option value="" disabled>
                Chọn mức độ
              </option>
              {WEXNER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        <p className="form-hint">
          Tổng điểm Wexner (tạm tính):{' '}
          {submission.computedScores?.wexner ?? liveWexnerTotal ?? '—'} / 20
        </p>
      </section>

      <section>
        <h2>Ghi nhận thêm</h2>
        <label htmlFor="additionalNotes">Ghi nhận thêm ý kiến/than phiền từ bệnh nhân</label>
        <textarea
          id="additionalNotes"
          rows={4}
          maxLength={2000}
          disabled={isReadOnly}
          value={responses.additionalNotes ?? ''}
          onChange={(e) => setField('additionalNotes', e.target.value)}
        />
      </section>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(`/patients/${patientId}`)}>
          Về hồ sơ bệnh nhân
        </button>
        {!isReadOnly && (
          <>
            <button type="button" className="btn btn-ghost" disabled={isSaving} onClick={saveDraft}>
              {isSaving ? 'Đang lưu...' : 'Lưu bản nháp'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isCompleting}
              onClick={completeForm}
            >
              {isCompleting ? 'Đang hoàn tất...' : 'Hoàn tất phiếu khám lại'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
