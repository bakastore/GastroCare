import { staffApi } from '../api/resources';
import type { StaffSpecialty } from '../api/resources';
import { useApiQuery } from '../api/useApiQuery';
import { ErrorState, LoadingState } from '../components/AsyncStates';
import { PageHeader } from '../components/PageHeader';

const SPECIALTY_LABEL: Record<StaffSpecialty, string> = {
  GASTROENTEROLOGY: 'Tiêu hoá',
  COLORECTAL_SURGERY: 'Ngoại đại trực tràng',
  GENERAL_SURGERY: 'Ngoại tổng quát',
  OTHER: 'Khác',
};
const EFFECTIVE_LABEL: Record<string, string> = {
  ACTIVE: 'Hiệu lực',
  EXPIRED: 'Hết hạn',
  REVOKED: 'Thu hồi',
};

/**
 * DEC-019 T6.3 — self profile. Read-only for every ACTIVE authenticated role.
 * Data comes from GET /auth/me/profile which resolves only the current user.
 * There is no self-edit action.
 */
export function SelfProfilePage() {
  const query = useApiQuery(() => staffApi.getSelfProfile(), []);

  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState message={query.error} />;
  if (!query.data) return null;

  const { account, profile, credentials } = query.data;

  return (
    <div>
      <PageHeader
        title="Hồ sơ của tôi"
        subtitle="Chỉ xem. Liên hệ quản trị cơ sở để cập nhật."
      />

      <section className="clinical-section">
        <h2>Tài khoản</h2>
        <p>Email: {account.email}</p>
        <p>Tên hiển thị: {account.displayName ?? '—'}</p>
        <p>Vai trò: {account.role}</p>
      </section>

      <section className="clinical-section">
        <h2>Hồ sơ nghề nghiệp</h2>
        {!profile && <p>Chưa có hồ sơ nghề nghiệp.</p>}
        {profile && (
          <>
            <p>Họ tên: {profile.fullName}</p>
            <p>Chức danh: {profile.professionalTitle ?? '—'}</p>
            <p>Điện thoại công việc: {profile.workPhone ?? '—'}</p>
            <p>
              Chuyên khoa chính:{' '}
              {profile.primarySpecialty
                ? SPECIALTY_LABEL[profile.primarySpecialty]
                : '—'}
            </p>
            {profile.secondarySpecialties.length > 0 && (
              <p>
                Chuyên khoa phụ:{' '}
                {profile.secondarySpecialties
                  .map((s) => SPECIALTY_LABEL[s])
                  .join(', ')}
              </p>
            )}
            {profile.specialtyOtherLabel && (
              <p>Khác: {profile.specialtyOtherLabel}</p>
            )}
            {profile.biography && <p>Giới thiệu: {profile.biography}</p>}
          </>
        )}
      </section>

      <section className="clinical-section">
        <h2>Chứng chỉ</h2>
        {credentials.length === 0 && <p>Chưa có chứng chỉ.</p>}
        {credentials.length > 0 && (
          <ul>
            {credentials.map((c) => (
              <li key={c.id}>
                {c.name} — {EFFECTIVE_LABEL[c.effectiveStatus]}
                {c.expiryDate ? ` (hết hạn ${c.expiryDate})` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
