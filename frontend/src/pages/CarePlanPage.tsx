import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { carePlansApi, careTasksApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate, formatDateTime } from '../lib/format';
import { flattenTimeline } from '../types/domain';

type FollowUpTaskAction = 'RESCHEDULE' | 'CANCEL' | 'KEEP_WITH_REASON';

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
  const [amendTaskAction, setAmendTaskAction] = useState<FollowUpTaskAction | ''>('');
  const [amendTaskReason, setAmendTaskReason] = useState('');
  const [amendError, setAmendError] = useState<string | null>(null);
  const [isSubmittingAmend, setIsSubmittingAmend] = useState(false);

  // The current OPEN generic follow-up CareTask for this CarePlan, if any
  // (DEC-012 §9-16). CareTask.dueDate = current operational schedule, kept
  // distinct from CarePlan.followUpDate = signed clinical intent — see the
  // "Lịch hẹn hiện tại" section below.
  const openTaskQuery = useApiQuery(async () => {
    const tasks = await careTasksApi.list();
    return (
      tasks.find(
        (t) =>
          t.carePlanId === carePlanId && t.status === 'OPEN' && t.timepointCode === null,
      ) ?? null
    );
  }, [carePlanId]);

  if (carePlanQuery.isLoading) return <LoadingState />;
  if (carePlanQuery.error) return <ErrorState message={carePlanQuery.error} />;
  const carePlan = carePlanQuery.data;
  if (!carePlan) return null;

  const currentInstructions = instructions ?? carePlan.instructions;
  const currentFollowUpDate =
    followUpDate ?? (carePlan.followUpDate ? carePlan.followUpDate.slice(0, 10) : '');

  const signedFollowUpDate = carePlan.followUpDate ? carePlan.followUpDate.slice(0, 10) : '';
  const followUpDateIsChanging =
    isAmending && (amendFollowUpDate || '') !== signedFollowUpDate;
  const requiresTaskReconciliation =
    followUpDateIsChanging && Boolean(openTaskQuery.data);
  const taskActionInvalidForNewDate =
    amendTaskAction === 'CANCEL' && Boolean(amendFollowUpDate);
  const amendBlocked =
    requiresTaskReconciliation &&
    (!amendTaskAction ||
      taskActionInvalidForNewDate ||
      (amendTaskAction === 'KEEP_WITH_REASON' && !amendTaskReason.trim()));

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
    // Correction batch C1 — never sign while the visible DRAFT has unsaved
    // edits. signPlan() only signs the persisted server state, so signing a
    // dirty draft would lock content the doctor never saved.
    if (isDraftDirty || isSaving) {
      setActionError('Có thay đổi chưa lưu. Hãy lưu bản nháp trước khi ký.');
      return;
    }
    setActionError(null);
    setIsSigning(true);
    try {
      await carePlansApi.sign(carePlanId as string);
      carePlanQuery.reload();
      timelineQuery.reload();
      openTaskQuery.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không ký được kế hoạch.');
    } finally {
      setIsSigning(false);
    }
  }

  function startAmend() {
    // Prefill from the currently signed content so "unchanged followUpDate"
    // (CD-08 §12) is actually unchanged unless the doctor edits it, and so
    // the reconciliation UI below only appears on a real date change.
    setAmendInstructions(carePlan?.instructions ?? '');
    setAmendFollowUpDate(signedFollowUpDate);
    setAmendReason('');
    setAmendTaskAction('');
    setAmendTaskReason('');
    setIsAmending(true);
  }

  async function submitAmend(event: FormEvent) {
    event.preventDefault();
    setAmendError(null);
    if (amendBlocked) return;
    setIsSubmittingAmend(true);
    try {
      await carePlansApi.amend(carePlanId as string, {
        instructions: amendInstructions,
        followUpDate: amendFollowUpDate || undefined,
        reason: amendReason,
        expectedCurrentVersionId: carePlan?.currentVersionId as string,
        followUpTaskAction: requiresTaskReconciliation
          ? (amendTaskAction as FollowUpTaskAction)
          : undefined,
        followUpTaskReason:
          requiresTaskReconciliation && amendTaskAction === 'KEEP_WITH_REASON'
            ? amendTaskReason
            : undefined,
      });
      setIsAmending(false);
      setAmendInstructions('');
      setAmendFollowUpDate('');
      setAmendReason('');
      setAmendTaskAction('');
      setAmendTaskReason('');
      carePlanQuery.reload();
      timelineQuery.reload();
      openTaskQuery.reload();
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
          {/* R1 — while a "Lưu bản nháp" request is in flight the visible
              draft must not be mutable: otherwise an edit made after the
              request started, followed by the older response clearing the
              dirty flag, would leave the visible state ahead of the
              persisted state and signable. */}
          <label htmlFor="instructions">Điều trị / dặn dò</label>
          <textarea
            id="instructions"
            rows={5}
            value={currentInstructions}
            disabled={isSaving}
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
            disabled={isSaving}
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
            <ConfirmSignButton
              onConfirm={signPlan}
              isSigning={isSigning}
              isDirty={isDraftDirty}
              isSaving={isSaving}
            />
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
              <strong>Ngày tái khám (ý định lâm sàng đã ký):</strong>{' '}
              {formatDate(carePlan.followUpDate)}
            </p>
          </div>

          <div className="signed-card">
            <p className="signed-note">
              Nhiệm vụ tái khám (lịch vận hành hiện tại) — có thể khác ngày tái khám đã ký ở trên
              nếu đã được dời lịch thao tác.
            </p>
            {openTaskQuery.isLoading && <LoadingState />}
            {!openTaskQuery.isLoading && !openTaskQuery.data && (
              <p className="form-hint">Không có nhiệm vụ tái khám đang mở cho kế hoạch này.</p>
            )}
            {openTaskQuery.data && (
              <p>
                <strong>Ngày hẹn hiện tại:</strong> {formatDate(openTaskQuery.data.dueDate)}
              </p>
            )}
          </div>

          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}

          {!isAmending && (
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={startAmend}>
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

              {requiresTaskReconciliation && (
                <div className="inline-form">
                  <p className="form-hint">
                    Ngày tái khám thay đổi và đang có nhiệm vụ tái khám mở (ngày hẹn hiện tại:{' '}
                    {formatDate(openTaskQuery.data?.dueDate ?? null)}). Chọn cách xử lý:
                  </p>
                  <label htmlFor="amendTaskAction">Xử lý nhiệm vụ tái khám</label>
                  <select
                    id="amendTaskAction"
                    required
                    value={amendTaskAction}
                    onChange={(e) => setAmendTaskAction(e.target.value as FollowUpTaskAction | '')}
                  >
                    <option value="" disabled>
                      Chọn cách xử lý
                    </option>
                    <option value="RESCHEDULE">Dời lịch nhiệm vụ theo ngày mới</option>
                    <option value="KEEP_WITH_REASON">Giữ nguyên ngày hẹn hiện tại (có lý do)</option>
                    {!amendFollowUpDate && <option value="CANCEL">Hủy nhiệm vụ tái khám</option>}
                  </select>
                  {amendTaskAction === 'KEEP_WITH_REASON' && (
                    <>
                      <label htmlFor="amendTaskReason">Lý do giữ nguyên</label>
                      <input
                        id="amendTaskReason"
                        required
                        value={amendTaskReason}
                        onChange={(e) => setAmendTaskReason(e.target.value)}
                      />
                    </>
                  )}
                </div>
              )}

              {amendError && (
                <p className="form-error" role="alert">
                  {amendError}
                </p>
              )}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setIsAmending(false)}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingAmend || amendBlocked}
                >
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
  isDirty,
  isSaving,
}: {
  onConfirm: () => void;
  isSigning: boolean;
  isDirty: boolean;
  isSaving: boolean;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  // Correction batch C1 + R1 — signing is unavailable whenever the visible
  // draft differs from persisted server state: it is dirty, OR a save is
  // still in flight (R1 race). Checked before the confirm branch, so
  // editing a field *after* opening the confirmation also disables
  // "Xác nhận ký".
  if (isDirty || isSaving) {
    return (
      <div className="confirm-inline">
        <button type="button" className="btn btn-primary" disabled aria-disabled="true">
          Ký kế hoạch
        </button>
        <p className="form-hint">
          {isSaving
            ? 'Đang lưu bản nháp…'
            : 'Có thay đổi chưa lưu. Hãy lưu bản nháp trước khi ký.'}
        </p>
      </div>
    );
  }

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
