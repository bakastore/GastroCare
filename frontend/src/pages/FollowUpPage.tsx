import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { careTasksApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ApiError } from '../api/client';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate } from '../lib/format';
import type { CareTaskStatus } from '../types/domain';

const filters: { value: CareTaskStatus; label: string }[] = [
  { value: 'OPEN', label: 'Đang mở' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

export function FollowUpPage() {
  const [statusFilter, setStatusFilter] = useState<CareTaskStatus>('OPEN');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

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

  async function completeTask(taskId: string) {
    setActionError(null);
    setPendingTaskId(taskId);
    try {
      await careTasksApi.complete(taskId);
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
            {visibleTasks.map((task) => (
              <tr key={task.id}>
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
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
