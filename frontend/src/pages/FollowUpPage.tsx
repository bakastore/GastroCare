import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { careTasksApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate, formatDateTime } from '../lib/format';
import { flattenTimeline } from '../types/domain';
import type { CareTask, CareTaskStatus } from '../types/domain';

const filters: { value: CareTaskStatus; label: string }[] = [
  { value: 'OPEN', label: 'Đang mở' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

export function FollowUpPage() {
  const [statusFilter, setStatusFilter] = useState<CareTaskStatus>('OPEN');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  // Explicit Return Encounter linkage (DEC-012 §16) and generic operational
  // reschedule (DEC-012 §15) are entered via a small inline panel per row,
  // never inferred — the doctor must open it and pick explicitly.
  const [returnPickerTaskId, setReturnPickerTaskId] = useState<string | null>(null);
  const [reschedulingTaskId, setReschedulingTaskId] = useState<string | null>(null);

  const tasksQuery = useApiQuery(() => careTasksApi.list(), []);
  const patientsQuery = useApiQuery(() => patientsApi.list(), []);

  const patientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const patient of patientsQuery.data ?? []) {
      map.set(patient.id, patient.fullName);
    }
    return map;
  }, [patientsQuery.data]);

  const visibleTasks = (tasksQuery.data ?? [])
    .filter((task) => task.status === statusFilter)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  async function completeTask(taskId: string, completedByEncounterId?: string) {
    setActionError(null);
    setPendingTaskId(taskId);
    try {
      await careTasksApi.complete(taskId, completedByEncounterId);
      setReturnPickerTaskId(null);
      tasksQuery.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không hoàn thành được nhiệm vụ.');
    } finally {
      setPendingTaskId(null);
    }
  }

  async function cancelTask(taskId: string) {
    setActionError(null);
    setPendingTaskId(taskId);
    try {
      await careTasksApi.cancel(taskId);
      tasksQuery.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không hủy được nhiệm vụ.');
    } finally {
      setPendingTaskId(null);
    }
  }

  async function rescheduleTask(taskId: string, dueDate: string) {
    setActionError(null);
    setPendingTaskId(taskId);
    try {
      await careTasksApi.reschedule(taskId, dueDate);
      setReschedulingTaskId(null);
      tasksQuery.reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Không dời được lịch nhiệm vụ.');
    } finally {
      setPendingTaskId(null);
    }
  }

  const isLoading = tasksQuery.isLoading || patientsQuery.isLoading;
  const error = tasksQuery.error ?? patientsQuery.error;

  return (
    <div>
      <h1>Theo dõi</h1>
      <p className="page-subtitle">Hàng đợi nhiệm vụ tái khám.</p>

      <div className="filter-row" role="tablist" aria-label="Lọc theo trạng thái">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={statusFilter === f.value}
            className={statusFilter === f.value ? 'filter-btn filter-btn-active' : 'filter-btn'}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {actionError && <ErrorState message={actionError} />}
      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!isLoading && !error && visibleTasks.length === 0 && (
        <EmptyState message="Không có nhiệm vụ nào ở trạng thái này." />
      )}

      {!isLoading && !error && visibleTasks.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bệnh nhân</th>
                <th>Ngày hẹn</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.map((task) => {
                // F4 — the two new T6 generic-task actions (explicit Return
                // Encounter completion, operational reschedule) apply only
                // to generic CarePlan follow-up tasks (carePlanId set,
                // timepointCode null). Longo timepoint tasks keep only the
                // pre-existing plain Complete/Cancel behavior — DEC-012 §15
                // reschedule and §16 linkage are scoped to the general
                // Hemorrhoid CarePlan follow-up task, not Longo scheduling.
                const isGenericFollowUpTask =
                  task.carePlanId !== null && task.timepointCode === null;
                return (
                <Fragment key={task.id}>
                  <tr>
                    <td>
                      <Link to={`/patients/${task.patientId}`}>
                        {patientNameById.get(task.patientId) ?? '—'}
                      </Link>
                    </td>
                    <td>{formatDate(task.dueDate)}</td>
                    <td>
                      {task.overdue ? (
                        <span className="badge badge-overdue">Quá hạn</span>
                      ) : (
                        <span className="badge badge-open">{task.status}</span>
                      )}
                    </td>
                    <td>
                      {task.status === 'OPEN' && (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={pendingTaskId === task.id}
                            onClick={() => completeTask(task.id)}
                          >
                            Hoàn thành
                          </button>
                          {isGenericFollowUpTask && (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={pendingTaskId === task.id}
                              onClick={() =>
                                setReturnPickerTaskId(
                                  returnPickerTaskId === task.id ? null : task.id,
                                )
                              }
                            >
                              Hoàn thành qua lượt tái khám
                            </button>
                          )}
                          {isGenericFollowUpTask && (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              disabled={pendingTaskId === task.id}
                              onClick={() =>
                                setReschedulingTaskId(
                                  reschedulingTaskId === task.id ? null : task.id,
                                )
                              }
                            >
                              Dời lịch
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={pendingTaskId === task.id}
                            onClick={() => cancelTask(task.id)}
                          >
                            Hủy
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {returnPickerTaskId === task.id && (
                    <tr>
                      <td colSpan={4}>
                        <ReturnEncounterPicker
                          task={task}
                          isPending={pendingTaskId === task.id}
                          onConfirm={(encounterId) => completeTask(task.id, encounterId)}
                          onCancel={() => setReturnPickerTaskId(null)}
                        />
                      </td>
                    </tr>
                  )}
                  {reschedulingTaskId === task.id && (
                    <tr>
                      <td colSpan={4}>
                        <RescheduleControl
                          task={task}
                          isPending={pendingTaskId === task.id}
                          onConfirm={(dueDate) => rescheduleTask(task.id, dueDate)}
                          onCancel={() => setReschedulingTaskId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Explicit Return Encounter linkage (DEC-012 §16) — the doctor must pick the
 * completing Encounter from this patient's own Encounter list; there is no
 * date/time inference and no auto-created Encounter. The Encounter list is
 * read from the existing Patient Timeline projection (no new endpoint).
 */
function ReturnEncounterPicker({
  task,
  isPending,
  onConfirm,
  onCancel,
}: {
  task: CareTask;
  isPending: boolean;
  onConfirm: (encounterId: string) => void;
  onCancel: () => void;
}) {
  const [encounterId, setEncounterId] = useState('');
  const timelineQuery = useApiQuery(
    () => patientsApi.getTimeline(task.patientId),
    [task.patientId],
  );

  const encounters = useMemo(() => {
    if (!timelineQuery.data) return [];
    return flattenTimeline(timelineQuery.data)
      .filter((e) => e.type === 'ENCOUNTER')
      .map((e) => ({
        id: String(e.data.id),
        reasonForVisit: String(e.data.reasonForVisit ?? ''),
        occurredAt: String(e.data.occurredAt ?? e.timestamp),
      }))
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [timelineQuery.data]);

  return (
    <div className="inline-form">
      <p className="form-hint">
        Chọn lượt tái khám hoàn tất nhiệm vụ này. Không tự động suy đoán theo ngày/giờ.
      </p>
      {timelineQuery.isLoading && <LoadingState />}
      {timelineQuery.error && <ErrorState message={timelineQuery.error} />}
      {!timelineQuery.isLoading && !timelineQuery.error && (
        <>
          <label htmlFor={`returnEncounter-${task.id}`}>Lượt tái khám</label>
          <select
            id={`returnEncounter-${task.id}`}
            value={encounterId}
            onChange={(e) => setEncounterId(e.target.value)}
          >
            <option value="">Chọn lượt khám</option>
            {encounters.map((e) => (
              <option key={e.id} value={e.id}>
                {formatDateTime(e.occurredAt)} — {e.reasonForVisit}
              </option>
            ))}
          </select>
        </>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Hủy
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!encounterId || isPending}
          onClick={() => onConfirm(encounterId)}
        >
          {isPending ? 'Đang lưu...' : 'Xác nhận hoàn thành'}
        </button>
      </div>
    </div>
  );
}

/** Generic operational reschedule (DEC-012 §15) — updates only CareTask.dueDate,
 * never CarePlan.followUpDate (the signed clinical intent). */
function RescheduleControl({
  task,
  isPending,
  onConfirm,
  onCancel,
}: {
  task: CareTask;
  isPending: boolean;
  onConfirm: (dueDate: string) => void;
  onCancel: () => void;
}) {
  const [dueDate, setDueDate] = useState(task.dueDate.slice(0, 10));

  return (
    <div className="inline-form">
      <label htmlFor={`reschedule-${task.id}`}>Ngày hẹn mới</label>
      <input
        id={`reschedule-${task.id}`}
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Hủy
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dueDate || isPending}
          onClick={() => onConfirm(dueDate)}
        >
          {isPending ? 'Đang lưu...' : 'Xác nhận dời lịch'}
        </button>
      </div>
    </div>
  );
}
