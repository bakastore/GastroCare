import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { carePlansApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate, formatDateTime } from '../lib/format';
import { flattenTimeline } from '../types/domain';

interface SignedVersion {
  versionNumber: number;
  instructions: string;
  followUpDate: string | null;
  reason: string | null;
  timestamp: string;
}

export function CarePlanPage() {
  const { carePlanId } = useParams<{ carePlanId: string }>();
  const navigate = useNavigate();

  const carePlanQuery = useApiQuery(() => carePlansApi.getById(carePlanId as string), [
    carePlanId,
  ]);

  const timelineQuery = useApiQuery(async () => {
    if (!carePlanQuery.data) return [] as SignedVersion[];
    const timeline = await patientsApi.getTimeline(carePlanQuery.data.patientId);
    const events = flattenTimeline(timeline);
    return events
      .filter(
        (e) =>
          e.type === 'CARE_PLAN_SIGNED' &&
          (e.data as { carePlanId?: string }).carePlanId === carePlanId,
      )
      .map((e) => e.data as unknown as SignedVersion)
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }, [carePlanQuery.data]);

  const [instructions, setInstructions] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState<string | null>(null);
  const [isDraftDirty, setIsDraftDirty] = useState(false);

  const [isSigning, setIsSigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isAmending, setIsAmending] = useState(false);
  const [amendInstructions, setAmendInstructions] = useState('');
  const [amendFollowUpDate, setAmendFollowUpDate] = useState('');
  const [amendReason, setAmendReason] = useState('');
  const [amendError, setAmendError] = useState<string | null>(null);
  const [isSubmittingAmend, setIsSubmittingAmend] = useState(false);

  if (carePlanQuery.isLoading) return <LoadingState />;
  if (carePlanQuery.error) return <ErrorState message={carePlanQuery.error} />;
  const carePlan = carePlanQuery.data;
  if (!carePlan) return null;

  const currentInstructions = instructions ?? carePlan.instructions;
  const currentFollowUpDate =
    followUpDate ?? (carePlan.followUpDate ? carePlan.followUpDate.slice(0, 10) : '');

  async function saveDraft() {
    setActionError(null);
    setIsSaving(true);
    try {
      await carePlansApi.updateDraft(carePlanId as string, {
        instructions: currentInstructions,
        followUpDate: currentFollowUpDate || undefined,
      });
      setIsDraftDirty(false);
      carePlanQuery.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không lưu được bản nháp.');
    } finally {
      setIsSaving(false);
    }
  }

  async function signPlan() {
    setActionError(null);
    setIsSigning(true);
    try {
      await carePlansApi.sign(carePlanId as string);
      carePlanQuery.reload();
      timelineQuery.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không ký được kế hoạch.');
    } finally {
      setIsSigning(false);
    }
  }

  async function submitAmend(event: FormEvent) {
    event.preventDefault();
    setAmendError(null);
    setIsSubmittingAmend(true);
    try {
      await carePlansApi.amend(carePlanId as string, {
        instructions: amendInstructions,
        followUpDate: amendFollowUpDate || undefined,
        reason: amendReason,
      });
      setIsAmending(false);
      setAmendInstructions('');
      setAmendFollowUpDate('');
      setAmendReason('');
      carePlanQuery.reload();
      timelineQuery.reload();
    } catch (err) {
      setAmendError(err instanceof ApiError ? err.message : 'Không sửa được kế hoạch.');
    } finally {
      setIsSubmittingAmend(false);
    }
  }

  return (
    <div className="form-page">
      <h1>Kế hoạch chăm sóc</h1>
      <p className="page-subtitle">
        Trạng thái:{' '}
        {carePlan.status === 'DRAFT' ? (
          <span className="badge badge-draft">Nháp</span>
        ) : (
          <span className="badge badge-signed">Đã ký</span>
        )}
      </p>

      {carePlan.status === 'DRAFT' && (
        <div>
          <label htmlFor="instructions">Điều trị / dặn dò</label>
          <textarea
            id="instructions"
            rows={5}
            value={currentInstructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              setIsDraftDirty(true);
            }}
          />

          <label htmlFor="followUpDate">Ngày tái khám (tùy chọn)</label>
          <input
            id="followUpDate"
            type="date"
            value={currentFollowUpDate}
            onChange={(e) => {
              setFollowUpDate(e.target.value);
              setIsDraftDirty(true);
            }}
          />

          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!isDraftDirty || isSaving}
              onClick={saveDraft}
            >
              {isSaving ? 'Đang lưu...' : 'Lưu bản nháp'}
            </button>
            <ConfirmSignButton onConfirm={signPlan} isSigning={isSigning} />
          </div>
        </div>
      )}

      {carePlan.status === 'SIGNED' && (
        <div>
          <div className="signed-card">
            <p className="signed-note">
              Nội dung đã ký — không thể chỉnh sửa trực tiếp. Muốn thay đổi, dùng "Sửa (tạo phiên
              bản mới)" bên dưới.
            </p>
            <p>
              <strong>Điều trị / dặn dò:</strong> {carePlan.instructions}
            </p>
            <p>
              <strong>Ngày tái khám:</strong> {formatDate(carePlan.followUpDate)}
            </p>
          </div>

          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}

          {!isAmending && (
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setIsAmending(true)}>
                Sửa (tạo phiên bản mới)
              </button>
            </div>
          )}

          {isAmending && (
            <form onSubmit={submitAmend} className="amend-form" noValidate>
              <h2>Sửa kế hoạch (Amendment)</h2>
              <label htmlFor="amendInstructions">Nội dung mới</label>
              <textarea
                id="amendInstructions"
                required
                rows={4}
                value={amendInstructions}
                onChange={(e) => setAmendInstructions(e.target.value)}
              />
              <label htmlFor="amendFollowUpDate">Ngày tái khám mới (tùy chọn)</label>
              <input
                id="amendFollowUpDate"
                type="date"
                value={amendFollowUpDate}
                onChange={(e) => setAmendFollowUpDate(e.target.value)}
              />
              <label htmlFor="amendReason">Lý do sửa</label>
              <input
                id="amendReason"
                required
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
              />
              {amendError && (
                <p className="form-error" role="alert">
                  {amendError}
                </p>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setIsAmending(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmittingAmend}>
                  {isSubmittingAmend ? 'Đang lưu...' : 'Lưu phiên bản mới'}
                </button>
              </div>
            </form>
          )}

          <h2>Lịch sử phiên bản đã ký</h2>
          {timelineQuery.isLoading && <LoadingState />}
          {(timelineQuery.data ?? []).length === 0 && !timelineQuery.isLoading && (
            <p className="form-hint">Chưa có lịch sử.</p>
          )}
          <ul className="version-history">
            {(timelineQuery.data ?? []).map((version) => (
              <li key={version.versionNumber}>
                <strong>Phiên bản {version.versionNumber}</strong> —{' '}
                {formatDateTime(version.timestamp)}
                {version.reason && <span> — Lý do: {version.reason}</span>}
                <p>{version.instructions}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => navigate(`/patients/${carePlan.patientId}`)}
        >
          Về hồ sơ bệnh nhân
        </button>
      </div>
    </div>
  );
}

function ConfirmSignButton({
  onConfirm,
  isSigning,
}: {
  onConfirm: () => void;
  isSigning: boolean;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  if (isConfirming) {
    return (
      <div className="confirm-inline" role="alertdialog" aria-label="Xác nhận ký">
        <p>Ký sẽ khóa nội dung hiện tại. Bạn chắc chắn?</p>
        <button type="button" className="btn btn-ghost" onClick={() => setIsConfirming(false)}>
          Không
        </button>
        <button type="button" className="btn btn-primary" disabled={isSigning} onClick={onConfirm}>
          {isSigning ? 'Đang ký...' : 'Xác nhận ký'}
        </button>
      </div>
    );
  }

  return (
    <button type="button" className="btn btn-primary" onClick={() => setIsConfirming(true)}>
      Ký kế hoạch
    </button>
  );
}
