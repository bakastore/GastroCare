import { EmptyState } from '../../components/AsyncStates';
import { PageHeader } from '../../components/PageHeader';

// DEMO UI — the backend records an append-only AuditEvent trail on every
// state change, but there is currently NO read API for it. Per the demo
// scope guard we do not fabricate a log view; this page states that plainly.
export function AuditLogPage() {
  return (
    <div>
      <PageHeader title="Nhật ký" subtitle="Nhật ký kiểm toán hệ thống." />
      <EmptyState message="Nhật ký kiểm toán được ghi ở máy chủ nhưng chưa có giao diện tra cứu trong bản demo này." />
    </div>
  );
}
