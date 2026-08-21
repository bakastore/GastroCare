import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const roleLabel: Record<string, string> = {
  DOCTOR: 'Bác sĩ',
  RECEPTIONIST: 'Lễ tân',
};

export function AppShell() {
  const { user, logout } = useAuth();

  if (!user) {
    return <Outlet />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">GastroCare</span>
        <nav className="primary-nav" aria-label="Điều hướng chính">
          {user.role === 'DOCTOR' && (
            <>
              <NavLink to="/today" className={navClass}>
                Hôm nay
              </NavLink>
              <NavLink to="/patients" className={navClass}>
                Bệnh nhân
              </NavLink>
              <NavLink to="/follow-up" className={navClass}>
                Theo dõi
              </NavLink>
            </>
          )}
          {user.role === 'RECEPTIONIST' && (
            <NavLink to="/patients" className={navClass}>
              Bệnh nhân
            </NavLink>
          )}
        </nav>
        <div className="topbar-user">
          <span className="user-role">{roleLabel[user.role] ?? user.role}</span>
          <span className="user-email">{user.email}</span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-link nav-link-active' : 'nav-link';
}
