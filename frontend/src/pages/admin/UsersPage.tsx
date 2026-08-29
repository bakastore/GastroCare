import { cliniciansApi } from '../../api/resources';
import { useApiQuery } from '../../api/useApiQuery';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncStates';
import { PageHeader } from '../../components/PageHeader';

// DEMO UI — view-only. The only user-directory API available today is
// GET /clinicians (DOCTOR-role clinicians in the tenant, id + email). There
// is no user-lifecycle / invite / password-reset API, and none is added
// here. Non-doctor accounts are not listable through a safe API, so they
// are intentionally not shown rather than faked.
export function UsersPage() {
  const query = useApiQuery(() => cliniciansApi.list(), []);

  return (
    <div>
      <PageHeader
        title="Người dùng"
        subtitle="Danh sách bác sĩ trong cơ sở (chỉ xem). Quản lý tài khoản đầy đủ không nằm trong bản demo."
      />

      {query.isLoading && <LoadingState />}
      {query.error && <ErrorState message={query.error} />}
      {!query.isLoading && !query.error && (query.data ?? []).length === 0 && (
        <EmptyState message="Chưa có bác sĩ nào." />
      )}
      {!query.isLoading && !query.error && (query.data ?? []).length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Vai trò</th>
              </tr>
            </thead>
            <tbody>
              {(query.data ?? []).map((clinician) => (
                <tr key={clinician.id}>
                  <td>{clinician.email}</td>
                  <td>Bác sĩ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
