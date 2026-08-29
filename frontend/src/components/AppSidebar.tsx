import { NavLink } from 'react-router-dom';
import type { AuthRole } from '../types/domain';

// DEMO UI NAVIGATION STRUCTURE v1 (OWNER LOCKED) — doctor-centered,
// clinical-first, compact. Frontend visibility only; the backend re-checks
// role/tenant on every request (see RouteGuards). Max two levels (group ->
// item). No Longo top-level entry. Clinician-facing wording: "Đợt điều trị"
// (Case), "Cận lâm sàng" (Investigation).

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
      key: 'admin',
      label: 'Quản trị',
      items: [
        { to: '/admin/users', label: 'Người dùng' },
        { to: '/admin/facilities', label: 'Cơ sở & phòng' },
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
    {
      key: 'admin',
      label: 'Quản trị',
      items: [
        { to: '/admin/users', label: 'Người dùng' },
        { to: '/admin/facilities', label: 'Cơ sở & phòng' },
      ],
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

export function navGroupsForRole(role: AuthRole): NavGroup[] {
  return GROUPS_BY_ROLE[role] ?? [];
}

function itemClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link';
}

export function AppSidebar({
  role,
  onNavigate,
}: {
  role: AuthRole;
  /** called after any nav item is chosen — lets the mobile drawer close */
  onNavigate?: () => void;
}) {
  return (
    <nav className="sidebar-nav" aria-label="Điều hướng chính">
      {navGroupsForRole(role).map((group) => (
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
