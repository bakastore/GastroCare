import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { careTasksApi, patientsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncStates';
import { formatDate } from '../lib/format';

export function TodayPage() {
  const tasksQuery = useApiQuery(() => careTasksApi.list(), []);
  const patientsQuery = useApiQuery(() => patientsApi.list(), []);

  const patientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const patient of patientsQuery.data ?? []) {
      map.set(patient.id, patient.fullName);
    }
    return map;
  }, [patientsQuery.data]);

  const isLoading = tasksQuery.isLoading || patientsQuery.isLoading;
  const error = tasksQuery.error ?? patientsQuery.error;

  const openTasks = (tasksQuery.data ?? [])
    .filter((task) => task.status === 'OPEN')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div>
      <h1>Hôm nay</h1>
      <p className="page-subtitle">Việc cần theo dõi — tái khám đang mở.</p>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!isLoading && !error && openTasks.length === 0 && (
        <EmptyState message="Không có việc theo dõi nào đang mở." />
      )}

      {!isLoading && !error && openTasks.length > 0 && (
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
            {openTasks.map((task) => (
              <tr key={task.id}>
                <td>{patientNameById.get(task.patientId) ?? '—'}</td>
                <td>{formatDate(task.dueDate)}</td>
                <td>
                  {task.overdue ? (
                    <span className="badge badge-overdue">Quá hạn</span>
                  ) : (
                    <span className="badge badge-open">Đang chờ</span>
                  )}
                </td>
                <td>
                  <Link className="btn btn-ghost" to={`/patients/${task.patientId}`}>
                    Mở bệnh nhân
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
