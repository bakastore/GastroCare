import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  clinicAdminUsersApi,
  facilitiesApi,
  staffApi,
} from '../../api/resources';
import type {
  ClinicAdminUser,
  ClinicAdminUserAuditEntry,
  EmploymentRecord,
  FacilityAssignment,
  StaffAuditEntry,
  StaffCredential,
  StaffProfile,
  StaffSpecialty,
} from '../../api/resources';
import { useApiQuery } from '../../api/useApiQuery';
import { ErrorState, LoadingState } from '../../components/AsyncStates';
import { PageHeader } from '../../components/PageHeader';
import { useNotification } from '../../components/NotificationProvider';
import { ApiError } from '../../api/client';

const SPECIALTY_LABEL: Record<StaffSpecialty, string> = {
  GASTROENTEROLOGY: 'Tiêu hoá',
  COLORECTAL_SURGERY: 'Ngoại đại trực tràng',
  GENERAL_SURGERY: 'Ngoại tổng quát',
  OTHER: 'Khác',
};
const CREDENTIAL_TYPE_LABEL: Record<string, string> = {
  LICENSE: 'Giấy phép',
  CERTIFICATE: 'Chứng chỉ',
  TRAINING: 'Đào tạo',
};
const EFFECTIVE_LABEL: Record<string, string> = {
  ACTIVE: 'Hiệu lực',
  EXPIRED: 'Hết hạn',
  REVOKED: 'Thu hồi',
};

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

type TabKey = 'overview' | 'specialty' | 'credentials' | 'employment' | 'audit';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'specialty', label: 'Chuyên môn' },
  { key: 'credentials', label: 'Chứng chỉ' },
  { key: 'employment', label: 'Công tác' },
  { key: 'audit', label: 'Nhật ký' },
];

export function UserDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<TabKey>('overview');

  const accountQuery = useApiQuery(
    () => clinicAdminUsersApi.getById(id),
    [id],
  );
  const profileQuery = useApiQuery(() => staffApi.getProfile(id), [id]);

  const profile = profileQuery.data?.profile ?? null;

  function reloadProfile() {
    profileQuery.reload();
  }

  return (
    <div>
      <PageHeader
        title="Chi tiết người dùng"
        subtitle="Hồ sơ nghề nghiệp, chứng chỉ, công tác và nhật ký."
      />
      <p>
        <Link to="/clinic-admin/users">← Danh sách người dùng</Link>
      </p>

      {accountQuery.isLoading && <LoadingState />}
      {accountQuery.error && <ErrorState message={accountQuery.error} />}

      {accountQuery.data && (
        <>
          <nav className="tab-bar" role="tablist" aria-label="Chi tiết người dùng">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={tab === t.key ? 'btn btn-primary' : 'btn btn-ghost'}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === 'overview' && (
            <OverviewTab
              account={accountQuery.data}
              profile={profile}
              loading={profileQuery.isLoading}
              error={profileQuery.error}
              onSaved={reloadProfile}
            />
          )}
          {tab === 'specialty' && (
            <SpecialtyTab
              userId={id}
              profile={profile}
              loading={profileQuery.isLoading}
              onSaved={reloadProfile}
            />
          )}
          {tab === 'credentials' && (
            <CredentialsTab userId={id} hasProfile={!!profile} />
          )}
          {tab === 'employment' && (
            <EmploymentTab userId={id} hasProfile={!!profile} />
          )}
          {tab === 'audit' && <AuditTab userId={id} />}
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
function useBusy() {
  const [busy, setBusy] = useState(false);
  const notify = useNotification();
  async function run<T>(
    fn: () => Promise<T>,
    okMsg: string,
    errFallback: string,
    onOk?: (r: T) => void,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fn();
      onOk?.(r);
      notify.success(okMsg);
    } catch (err) {
      notify.error(errMessage(err, errFallback));
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{children}</span>
    </div>
  );
}

// --------------------------------------------------------------------------
function OverviewTab({
  account,
  profile,
  loading,
  error,
  onSaved,
}: {
  account: ClinicAdminUser;
  profile: StaffProfile | null;
  loading: boolean;
  error: string | null;
  onSaved: () => void;
}) {
  const { busy, run } = useBusy();
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [professionalTitle, setProfessionalTitle] = useState(
    profile?.professionalTitle ?? '',
  );
  const [workPhone, setWorkPhone] = useState(profile?.workPhone ?? '');
  const [biography, setBiography] = useState(profile?.biography ?? '');
  const [formError, setFormError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim()) {
      setFormError('Họ tên là bắt buộc.');
      return;
    }
    void run(
      () =>
        staffApi.putProfile(account.id, {
          fullName: fullName.trim(),
          professionalTitle: professionalTitle.trim() || null,
          workPhone: workPhone.trim() || null,
          biography: biography.trim() || null,
        }),
      profile ? 'Đã cập nhật hồ sơ' : 'Đã tạo hồ sơ',
      'Không lưu được hồ sơ.',
      onSaved,
    );
  }

  return (
    <section className="clinical-section">
      <h2>Tài khoản</h2>
      <Field label="Email">{account.email}</Field>
      <Field label="Tên hiển thị">{account.displayName ?? '—'}</Field>
      <Field label="Vai trò">{account.role}</Field>
      <Field label="Trạng thái">
        {account.status === 'ACTIVE' ? 'Hoạt động' : 'Vô hiệu hoá'}
      </Field>
      <Field label="Quản trị cơ sở">{account.isClinicAdmin ? 'Có' : '—'}</Field>

      <h2>Hồ sơ cơ bản</h2>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} />}
      {!loading && (
        <form onSubmit={submit} className="stacked-form">
          <label htmlFor="sp-fullname">Họ tên *</label>
          <input
            id="sp-fullname"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <label htmlFor="sp-title">Chức danh chuyên môn</label>
          <input
            id="sp-title"
            value={professionalTitle}
            onChange={(e) => setProfessionalTitle(e.target.value)}
          />
          <label htmlFor="sp-phone">Điện thoại công việc</label>
          <input
            id="sp-phone"
            value={workPhone}
            onChange={(e) => setWorkPhone(e.target.value)}
          />
          <label htmlFor="sp-bio">Giới thiệu</label>
          <textarea
            id="sp-bio"
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
          />
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Đang lưu…' : profile ? 'Lưu hồ sơ' : 'Tạo hồ sơ'}
          </button>
        </form>
      )}
    </section>
  );
}

// --------------------------------------------------------------------------
const ALL_SPECIALTIES: StaffSpecialty[] = [
  'GASTROENTEROLOGY',
  'COLORECTAL_SURGERY',
  'GENERAL_SURGERY',
  'OTHER',
];

function SpecialtyTab({
  userId,
  profile,
  loading,
  onSaved,
}: {
  userId: string;
  profile: StaffProfile | null;
  loading: boolean;
  onSaved: () => void;
}) {
  const { busy, run } = useBusy();
  const [primary, setPrimary] = useState<StaffSpecialty | ''>(
    profile?.primarySpecialty ?? '',
  );
  const [secondary, setSecondary] = useState<StaffSpecialty[]>(
    profile?.secondarySpecialties ?? [],
  );
  const [otherLabel, setOtherLabel] = useState(
    profile?.specialtyOtherLabel ?? '',
  );

  if (loading) return <LoadingState />;
  if (!profile) {
    return (
      <section className="clinical-section">
        <p>Hãy tạo hồ sơ cơ bản ở tab Tổng quan trước.</p>
      </section>
    );
  }

  function toggleSecondary(s: StaffSpecialty) {
    setSecondary((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void run(
      () =>
        staffApi.putProfile(userId, {
          primarySpecialty: primary || null,
          secondarySpecialties: secondary,
          specialtyOtherLabel: otherLabel.trim() || null,
        }),
      'Đã cập nhật chuyên môn',
      'Không lưu được chuyên môn.',
      onSaved,
    );
  }

  const showOther = primary === 'OTHER' || secondary.includes('OTHER');

  return (
    <section className="clinical-section">
      <h2>Chuyên môn</h2>
      <form onSubmit={submit} className="stacked-form">
        <label htmlFor="sp-primary">Chuyên khoa chính</label>
        <select
          id="sp-primary"
          value={primary}
          onChange={(e) => setPrimary(e.target.value as StaffSpecialty | '')}
        >
          <option value="">— Không chọn —</option>
          {ALL_SPECIALTIES.map((s) => (
            <option key={s} value={s}>
              {SPECIALTY_LABEL[s]}
            </option>
          ))}
        </select>

        <fieldset>
          <legend>Chuyên khoa phụ</legend>
          {ALL_SPECIALTIES.map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                checked={secondary.includes(s)}
                onChange={() => toggleSecondary(s)}
              />{' '}
              {SPECIALTY_LABEL[s]}
            </label>
          ))}
        </fieldset>

        {showOther && (
          <>
            <label htmlFor="sp-other">Mô tả "Khác"</label>
            <input
              id="sp-other"
              value={otherLabel}
              onChange={(e) => setOtherLabel(e.target.value)}
            />
          </>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu chuyên môn'}
        </button>
      </form>
    </section>
  );
}

// --------------------------------------------------------------------------
function CredentialsTab({
  userId,
  hasProfile,
}: {
  userId: string;
  hasProfile: boolean;
}) {
  const query = useApiQuery(
    () => (hasProfile ? staffApi.listCredentials(userId) : Promise.resolve([])),
    [userId, hasProfile],
  );
  const { busy, run } = useBusy();
  const [showAdd, setShowAdd] = useState(false);

  if (!hasProfile) {
    return (
      <section className="clinical-section">
        <p>Hãy tạo hồ sơ cơ bản ở tab Tổng quan trước.</p>
      </section>
    );
  }

  function del(c: StaffCredential) {
    if (!window.confirm(`Xoá vĩnh viễn chứng chỉ "${c.name}"?`)) return;
    void run(
      () => staffApi.deleteCredential(userId, c.id),
      'Đã xoá chứng chỉ',
      'Không xoá được chứng chỉ.',
      () => query.reload(),
    );
  }

  return (
    <section className="clinical-section">
      <h2>Chứng chỉ</h2>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setShowAdd((v) => !v)}
      >
        {showAdd ? 'Đóng' : 'Thêm chứng chỉ'}
      </button>

      {showAdd && (
        <CredentialForm
          onSubmit={(dto, done) =>
            run(
              () => staffApi.addCredential(userId, dto),
              'Đã thêm chứng chỉ',
              'Không thêm được chứng chỉ.',
              () => {
                done();
                setShowAdd(false);
                query.reload();
              },
            )
          }
          busy={busy}
        />
      )}

      {query.isLoading && <LoadingState />}
      {query.error && <ErrorState message={query.error} />}
      {!query.isLoading && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Loại</th>
              <th>Cấp</th>
              <th>Hết hạn</th>
              <th>Hiệu lực</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{CREDENTIAL_TYPE_LABEL[c.credentialType]}</td>
                <td>{c.issueDate ?? '—'}</td>
                <td>{c.expiryDate ?? '—'}</td>
                <td data-testid={`cred-eff-${c.id}`}>
                  {EFFECTIVE_LABEL[c.effectiveStatus]}
                </td>
                <td className="row-actions">
                  {c.status === 'ACTIVE' && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            staffApi.updateCredential(userId, c.id, {
                              status: 'REVOKED',
                            }),
                          'Đã thu hồi chứng chỉ',
                          'Không thu hồi được.',
                          () => query.reload(),
                        )
                      }
                    >
                      Thu hồi
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => del(c)}
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {(query.data ?? []).length === 0 && (
              <tr>
                <td colSpan={6}>Chưa có chứng chỉ.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

function CredentialForm({
  onSubmit,
  busy,
}: {
  onSubmit: (dto: Record<string, unknown>, done: () => void) => void;
  busy: boolean;
}) {
  const [credentialType, setCredentialType] = useState('LICENSE');
  const [name, setName] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit(
      {
        credentialType,
        name: name.trim(),
        issueDate: issueDate || undefined,
        expiryDate: expiryDate || undefined,
      },
      () => {
        setName('');
        setIssueDate('');
        setExpiryDate('');
      },
    );
  }

  return (
    <form onSubmit={submit} className="stacked-form">
      <label htmlFor="cf-type">Loại</label>
      <select
        id="cf-type"
        value={credentialType}
        onChange={(e) => setCredentialType(e.target.value)}
      >
        <option value="LICENSE">Giấy phép</option>
        <option value="CERTIFICATE">Chứng chỉ</option>
        <option value="TRAINING">Đào tạo</option>
      </select>
      <label htmlFor="cf-name">Tên *</label>
      <input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="cf-issue">Ngày cấp</label>
      <input
        id="cf-issue"
        type="date"
        value={issueDate}
        onChange={(e) => setIssueDate(e.target.value)}
      />
      <label htmlFor="cf-expiry">Ngày hết hạn</label>
      <input
        id="cf-expiry"
        type="date"
        value={expiryDate}
        onChange={(e) => setExpiryDate(e.target.value)}
      />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Đang lưu…' : 'Lưu chứng chỉ'}
      </button>
    </form>
  );
}

// --------------------------------------------------------------------------
function EmploymentTab({
  userId,
  hasProfile,
}: {
  userId: string;
  hasProfile: boolean;
}) {
  const employmentQuery = useApiQuery(
    () =>
      hasProfile ? staffApi.listEmployment(userId) : Promise.resolve([]),
    [userId, hasProfile],
  );
  const assignmentsQuery = useApiQuery(
    () =>
      hasProfile ? staffApi.listAssignments(userId) : Promise.resolve([]),
    [userId, hasProfile],
  );
  const facilitiesQuery = useApiQuery(() => facilitiesApi.list(), []);
  const { busy, run } = useBusy();
  const [showEmp, setShowEmp] = useState(false);
  const [newFacilityId, setNewFacilityId] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newPrimary, setNewPrimary] = useState(false);

  const facilityName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of facilitiesQuery.data ?? []) m[f.id] = f.name;
    return m;
  }, [facilitiesQuery.data]);

  if (!hasProfile) {
    return (
      <section className="clinical-section">
        <p>Hãy tạo hồ sơ cơ bản ở tab Tổng quan trước.</p>
      </section>
    );
  }

  const assignments = assignmentsQuery.data ?? [];
  const activeAssignments = assignments.filter((a) => a.active);

  function addAssignment(e: FormEvent) {
    e.preventDefault();
    if (!newFacilityId || !newStart) return;
    void run(
      () =>
        staffApi.addAssignment(userId, {
          facilityId: newFacilityId,
          startDate: newStart,
          makePrimary: newPrimary,
        }),
      'Đã thêm phân công cơ sở',
      'Không thêm được phân công.',
      () => {
        setNewFacilityId('');
        setNewStart('');
        setNewPrimary(false);
        assignmentsQuery.reload();
      },
    );
  }

  function makePrimary(a: FacilityAssignment) {
    void run(
      () => staffApi.patchAssignment(userId, a.id, { makePrimary: true }),
      'Đã đổi cơ sở chính',
      'Không đổi được cơ sở chính.',
      () => assignmentsQuery.reload(),
    );
  }

  function endAssignment(a: FacilityAssignment) {
    const otherActive = activeAssignments.filter((x) => x.id !== a.id);
    let replacementPrimaryAssignmentId: string | undefined;
    if (a.isPrimary && otherActive.length > 0) {
      const choice = window.prompt(
        `Kết thúc cơ sở chính. Nhập ID phân công thay thế làm cơ sở chính:\n${otherActive
          .map((x) => `${x.id} — ${facilityName[x.facilityId] ?? x.facilityId}`)
          .join('\n')}`,
      );
      if (!choice) return;
      replacementPrimaryAssignmentId = choice.trim();
    } else if (!window.confirm('Kết thúc phân công này?')) {
      return;
    }
    void run(
      () =>
        staffApi.patchAssignment(userId, a.id, {
          end: true,
          replacementPrimaryAssignmentId,
        }),
      'Đã kết thúc phân công',
      'Không kết thúc được phân công.',
      () => assignmentsQuery.reload(),
    );
  }

  return (
    <section className="clinical-section">
      <h2>Phân công cơ sở</h2>
      <form onSubmit={addAssignment} className="inline-form">
        <select
          aria-label="Cơ sở"
          value={newFacilityId}
          onChange={(e) => setNewFacilityId(e.target.value)}
        >
          <option value="">— Chọn cơ sở —</option>
          {(facilitiesQuery.data ?? []).map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label="Ngày bắt đầu"
          value={newStart}
          onChange={(e) => setNewStart(e.target.value)}
        />
        <label>
          <input
            type="checkbox"
            checked={newPrimary}
            onChange={(e) => setNewPrimary(e.target.checked)}
          />{' '}
          Cơ sở chính
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Thêm
        </button>
      </form>

      {assignmentsQuery.isLoading && <LoadingState />}
      {assignmentsQuery.error && <ErrorState message={assignmentsQuery.error} />}
      <table className="data-table">
        <thead>
          <tr>
            <th>Cơ sở</th>
            <th>Bắt đầu</th>
            <th>Kết thúc</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.id}>
              <td>{facilityName[a.facilityId] ?? a.facilityId}</td>
              <td>{a.startDate ?? '—'}</td>
              <td>{a.endDate ?? '—'}</td>
              <td>
                {a.active ? 'Đang hoạt động' : 'Đã kết thúc'}
                {a.isPrimary && a.active ? (
                  <span className="badge badge-primary"> · Chính</span>
                ) : null}
              </td>
              <td className="row-actions">
                {a.active && !a.isPrimary && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => makePrimary(a)}
                  >
                    Đặt làm chính
                  </button>
                )}
                {a.active && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => endAssignment(a)}
                  >
                    Kết thúc
                  </button>
                )}
              </td>
            </tr>
          ))}
          {assignments.length === 0 && (
            <tr>
              <td colSpan={5}>Chưa có phân công cơ sở.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Lịch sử công tác</h2>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setShowEmp((v) => !v)}
      >
        {showEmp ? 'Đóng' : 'Thêm công tác'}
      </button>
      {showEmp && (
        <EmploymentForm
          busy={busy}
          onSubmit={(dto, done) =>
            run(
              () => staffApi.addEmployment(userId, dto),
              'Đã thêm bản ghi công tác',
              'Không thêm được bản ghi.',
              () => {
                done();
                setShowEmp(false);
                employmentQuery.reload();
              },
            )
          }
        />
      )}
      {employmentQuery.isLoading && <LoadingState />}
      <table className="data-table">
        <thead>
          <tr>
            <th>Tổ chức</th>
            <th>Chức vụ</th>
            <th>Bắt đầu</th>
            <th>Kết thúc</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(employmentQuery.data ?? []).map((r: EmploymentRecord) => (
            <tr key={r.id}>
              <td>{r.organizationName}</td>
              <td>{r.positionTitle ?? '—'}</td>
              <td>{r.startDate ?? '—'}</td>
              <td>{r.endDate ?? '—'}</td>
              <td className="row-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Xoá vĩnh viễn bản ghi công tác "${r.organizationName}"?`,
                      )
                    )
                      return;
                    void run(
                      () => staffApi.deleteEmployment(userId, r.id),
                      'Đã xoá bản ghi công tác',
                      'Không xoá được bản ghi.',
                      () => employmentQuery.reload(),
                    );
                  }}
                >
                  Xoá
                </button>
              </td>
            </tr>
          ))}
          {(employmentQuery.data ?? []).length === 0 && (
            <tr>
              <td colSpan={5}>Chưa có bản ghi công tác.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function EmploymentForm({
  onSubmit,
  busy,
}: {
  onSubmit: (dto: Record<string, unknown>, done: () => void) => void;
  busy: boolean;
}) {
  const [organizationName, setOrg] = useState('');
  const [positionTitle, setPos] = useState('');
  const [startDate, setStart] = useState('');
  const [endDate, setEnd] = useState('');

  return (
    <form
      className="stacked-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!organizationName.trim() || !startDate) return;
        onSubmit(
          {
            organizationName: organizationName.trim(),
            positionTitle: positionTitle.trim() || undefined,
            startDate,
            endDate: endDate || undefined,
          },
          () => {
            setOrg('');
            setPos('');
            setStart('');
            setEnd('');
          },
        );
      }}
    >
      <label htmlFor="ef-org">Tổ chức *</label>
      <input id="ef-org" value={organizationName} onChange={(e) => setOrg(e.target.value)} />
      <label htmlFor="ef-pos">Chức vụ</label>
      <input id="ef-pos" value={positionTitle} onChange={(e) => setPos(e.target.value)} />
      <label htmlFor="ef-start">Bắt đầu *</label>
      <input id="ef-start" type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
      <label htmlFor="ef-end">Kết thúc</label>
      <input id="ef-end" type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Đang lưu…' : 'Lưu công tác'}
      </button>
    </form>
  );
}

// --------------------------------------------------------------------------
interface MergedAuditRow {
  id: string;
  seq: number;
  action: string;
  createdAt: string;
  source: 'DEC-018' | 'DEC-019';
}

function AuditTab({ userId }: { userId: string }) {
  const userAudit = useApiQuery(
    () => clinicAdminUsersApi.getAudit(userId),
    [userId],
  );
  const staffAudit = useApiQuery(() => staffApi.getStaffAudit(userId), [userId]);

  const rows = useMemo<MergedAuditRow[]>(() => {
    const a: MergedAuditRow[] = (userAudit.data ?? []).map(
      (e: ClinicAdminUserAuditEntry) => ({
        id: e.id,
        seq: e.seq,
        action: e.action,
        createdAt: e.createdAt,
        source: 'DEC-018' as const,
      }),
    );
    const b: MergedAuditRow[] = (staffAudit.data ?? []).map(
      (e: StaffAuditEntry) => ({
        id: e.id,
        seq: e.seq,
        action: e.action,
        createdAt: e.createdAt,
        source: 'DEC-019' as const,
      }),
    );
    return [...a, ...b].sort((x, y) => x.seq - y.seq);
  }, [userAudit.data, staffAudit.data]);

  return (
    <section className="clinical-section">
      <h2>Nhật ký</h2>
      {(userAudit.isLoading || staffAudit.isLoading) && <LoadingState />}
      {userAudit.error && <ErrorState message={userAudit.error} />}
      {staffAudit.error && <ErrorState message={staffAudit.error} />}
      <table className="data-table">
        <thead>
          <tr>
            <th>seq</th>
            <th>Hành động</th>
            <th>Nguồn</th>
            <th>Thời gian</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={`${e.source}-${e.id}`}>
              <td>{e.seq}</td>
              <td>
                <code>{e.action}</code>
              </td>
              <td>{e.source}</td>
              <td>{new Date(e.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4}>Chưa có sự kiện.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
