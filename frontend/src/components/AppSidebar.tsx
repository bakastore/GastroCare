import { NavLink } from 'react-router-dom';
import type { AuthRole } from '../types/domain';

// DEMO UI NAVIGATION STRUCTURE v1 (DEC-017, OWNER LOCKED) — doctor-centered,
// clinical-first, compact. DEC-018 supersedes only the admin-route /
// admin-visibility portion: the "Quản trị" group is now gated by the Clinic
// Admin capability (isClinicAdmin), not by operational role, and its Phase 1
// items live under the canonical /clinic-admin/* namespace. Frontend
// visibility is not the security boundary — the backend re-checks
// role/tenant/capability on every request (see RouteGuards).

export interface NavItem {
  to: string;
  label: string;
  /** match child routes too (default: exact) */
  end?: boolean;
}
export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

const GROUPS_BY_ROLE: Record<AuthRole, NavGroup[]> = {
  DOCTOR: [
    {
      key: 'work',
      label: 'Công việc',
      items: [
        { to: '/today', label: 'Hôm nay' },
        { to: '/follow-up', label: 'Theo dõi' },
      ],
    },
    {
      key: 'clinical',
      label: 'Lâm sàng',
      items: [
        { to: '/patients', label: 'Bệnh nhân', end: false },
        { to: '/treatment-cases', label: 'Đợt điều trị' },
        { to: '/investigations/assigned', label: 'Cận lâm sàng' },
      ],
    },
    {
      key: 'tools',
      label: 'Tiện ích',
      items: [
        { to: '/admin/form-templates', label: 'Mẫu biểu' },
        { to: '/admin/audit-log', label: 'Nhật ký' },
      ],
    },
  ],
  RECEPTIONIST: [
    {
      key: 'clinical',
      label: 'Lâm sàng',
      items: [{ to: '/patients', label: 'Bệnh nhân', end: false }],
    },
  ],
  NURSE: [
    {
      key: 'clinical',
      label: 'Lâm sàng',
      items: [{ to: '/investigations/assigned', label: 'Cận lâm sàng' }],
    },
  ],
};

// DEC-018 — the Clinic Admin group, shown to any ACTIVE user who holds the
// capability regardless of operational role.
const CLINIC_ADMIN_GROUP: NavGroup = {
  key: 'admin',
  label: 'Quản trị',
  items: [
    { to: '/clinic-admin/users', label: 'Người dùng' },
    { to: '/clinic-admin/facilities', label: 'Cơ sở & phòng' },
  ],
};

export function navGroupsFor(
  role: AuthRole,
  isClinicAdmin: boolean,
): NavGroup[] {
  const base = GROUPS_BY_ROLE[role] ?? [];
  return isClinicAdmin ? [...base, CLINIC_ADMIN_GROUP] : base;
}

function itemClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link';
}

export function AppSidebar({
  role,
  isClinicAdmin,
  onNavigate,
}: {
  role: AuthRole;
  isClinicAdmin: boolean;
  /** called after any nav item is chosen — lets the mobile drawer close */
  onNavigate?: () => void;
}) {
  return (
    <nav className="sidebar-nav" aria-label="Điều hướng chính">
      {navGroupsFor(role, isClinicAdmin).map((group) => (
        <div key={group.key} className="sidebar-group">
          <p className="sidebar-group-label">{group.label}</p>
          <ul>
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end ?? true}
                  className={itemClass}
                  onClick={onNavigate}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
