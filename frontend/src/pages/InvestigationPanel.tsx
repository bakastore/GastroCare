import { useState } from 'react';
import { investigationsApi } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { useAuth } from '../auth/AuthContext';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import { PageHeader } from '../components/PageHeader';
import { formatDateTime } from '../lib/format';
import type { Investigation } from '../types/domain';
export function InvestigationPanel({ caseId }: { caseId: string }) {
  const query = useApiQuery(() => investigationsApi.list(caseId), [caseId]);
  const assignees = useApiQuery(() => investigationsApi.assignees(), []);
  const [label, setLabel] = useState(''),
    [origin, setOrigin] = useState<Investigation['origin']>('INTERNAL_CURRENT'),
    [parent, setParent] = useState(''),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      await investigationsApi.create({
        caseId,
        label,
        origin,
        ...(parent ? { parentInvestigationId: parent } : {}),
      });
      setLabel('');
      query.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được CLS');
    } finally {
      setPending(false);
    }
  }
  return (
    <section>
      <h4>Cận lâm sàng (CLS)</h4>
      <p className="form-hint">
        Kết quả thô là dữ liệu, không phải diễn giải lâm sàng. PDF/ảnh chưa được hỗ trợ.
      </p>
      {query.isLoading && <LoadingState />}
      {(error || query.error || assignees.error) && (
        <ErrorState message={error || query.error || assignees.error!} />
      )}
      <form className="inline-form" onSubmit={create}>
        <label htmlFor={`investigation-label-${caseId}`}>Tên CLS</label>
        <input
          id={`investigation-label-${caseId}`}
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <label htmlFor={`origin-${caseId}`}>Nguồn CLS</label>
        <select
          id={`origin-${caseId}`}
          value={origin}
          onChange={(e) => setOrigin(e.target.value as Investigation['origin'])}
        >
          <option value="INTERNAL_CURRENT">Chỉ định hiện tại</option>
          <option value="ECOSYSTEM_PRIOR">Kết quả trước trong hệ sinh thái</option>
          <option value="EXTERNAL_PRIOR">Kết quả trước bên ngoài</option>
        </select>
        <label htmlFor={`parent-${caseId}`}>CLS cha (liên kết tường minh)</label>
        <select id={`parent-${caseId}`} value={parent} onChange={(e) => setParent(e.target.value)}>
          <option value="">Không liên kết</option>
          {(query.data ?? []).map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          Thêm CLS
        </button>
      </form>
      {(query.data ?? []).map((inv) => (
        <InvestigationCard
          key={inv.id}
          inv={inv}
          nurse={false}
          assignees={assignees.data ?? []}
          onChanged={query.reload}
          parentLabel={query.data?.find((p) => p.id === inv.parentInvestigationId)?.label}
        />
      ))}
    </section>
  );
}
// Assigned-CLS queue (DEMO UI: "Cận lâm sàng"). Reachable by NURSE and
// DOCTOR — GET /investigations/assigned is @Roles(DOCTOR, NURSE) and only
// ever returns work assigned to the caller. Result entry is gated to the
// NURSE affordance exactly as before.
export function NurseInvestigationsPage() {
  const { user } = useAuth();
  const isNurse = user?.role === 'NURSE';
  const query = useApiQuery(() => investigationsApi.assigned(), []);
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState message={query.error} />;
  return (
    <div>
      <PageHeader
        title="Cận lâm sàng"
        subtitle="Công việc CLS được giao cho bạn — chỉ nhập kết quả thô."
      />
      {!query.data?.length && <p>Chưa có CLS được giao.</p>}
      {(query.data ?? []).map((inv) => (
        <InvestigationCard
          key={inv.id}
          inv={inv}
          nurse={isNurse}
          onChanged={query.reload}
          assignees={[]}
        />
      ))}
    </div>
  );
}
function InvestigationCard({
  inv,
  nurse,
  onChanged,
  assignees,
  parentLabel,
}: {
  inv: Investigation;
  nurse: boolean;
  onChanged: () => void;
  assignees: { id: string; email: string }[];
  parentLabel?: string;
}) {
  const [requestText, setRequestText] = useState(''),
    [assignedTo, setAssignedTo] = useState(''),
    [requestedAt, setRequestedAt] = useState('');
  const [orderId, setOrderId] = useState(''),
    [rawText, setRawText] = useState(''),
    [observedAt, setObservedAt] = useState('');
  const [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError('');
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được CLS');
    } finally {
      setPending(false);
    }
  }
  const active = inv.careCase.status === 'ACTIVE';
  return (
    <article className="episode-card">
      <h4>{inv.label}</h4>
      <p>
        {inv.origin} · {inv.patient.fullName} · Case {inv.careCase.status}
      </p>
      {inv.parentInvestigationId && <p>CLS cha: {parentLabel ?? 'Đã liên kết tường minh'}</p>}
      {error && <ErrorState message={error} />}
      {!nurse && active && inv.origin === 'INTERNAL_CURRENT' && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              investigationsApi.order(inv.id, {
                requestText,
                requestedAt: new Date(requestedAt).toISOString(),
                ...(assignedTo ? { assignedToUserId: assignedTo } : {}),
              }),
            );
          }}
        >
          <label htmlFor={`request-${inv.id}`}>Nội dung chỉ định</label>
          <textarea
            id={`request-${inv.id}`}
            required
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
          />
          <label htmlFor={`request-at-${inv.id}`}>Thời điểm chỉ định</label>
          <input
            id={`request-at-${inv.id}`}
            type="datetime-local"
            required
            value={requestedAt}
            onChange={(e) => setRequestedAt(e.target.value)}
          />
          <label htmlFor={`assigned-${inv.id}`}>Giao cho</label>
          <select
            id={`assigned-${inv.id}`}
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">Chưa giao</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={pending}>
            Tạo chỉ định
          </button>
        </form>
      )}
      {inv.orders.map((o, i) => (
        <p key={o.id}>
          Chỉ định #{i + 1}: {o.requestText} · {formatDateTime(o.requestedAt)}
        </p>
      ))}
      {inv.results.map((r) => (
        <div key={r.id}>
          <strong>Kết quả thô · {formatDateTime(r.observedAt)}</strong>
          <p style={{ whiteSpace: 'pre-wrap' }}>{r.rawText}</p>
        </div>
      ))}
      {active && (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              investigationsApi.result(inv.id, {
                ...(orderId ? { orderId } : {}),
                rawText,
                observedAt: new Date(observedAt).toISOString(),
              }),
            );
          }}
        >
          {(inv.origin === 'INTERNAL_CURRENT' || nurse) && (
            <>
              <label htmlFor={`order-${inv.id}`}>Chỉ định tương ứng</label>
              <select
                id={`order-${inv.id}`}
                required
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              >
                <option value="">Chọn chỉ định</option>
                {inv.orders.map((o, i) => (
                  <option key={o.id} value={o.id}>
                    #{i + 1} · {o.requestText}
                  </option>
                ))}
              </select>
            </>
          )}
          <label htmlFor={`raw-${inv.id}`}>Kết quả thô</label>
          <textarea
            id={`raw-${inv.id}`}
            required
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
          <label htmlFor={`observed-${inv.id}`}>Thời điểm kết quả</label>
          <input
            id={`observed-${inv.id}`}
            type="datetime-local"
            required
            value={observedAt}
            onChange={(e) => setObservedAt(e.target.value)}
          />
          <button className="btn btn-primary" disabled={pending}>
            Lưu kết quả thô
          </button>
        </form>
      )}
    </article>
  );
}
