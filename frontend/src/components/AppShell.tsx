import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppSidebar } from './AppSidebar';

const roleLabel: Record<string, string> = {
  DOCTOR: 'Bác sĩ',
  NURSE: 'Điều dưỡng',
  RECEPTIONIST: 'Lễ tân',
};

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (!user) {
    return <Outlet />;
  }

  return (
    <div className={drawerOpen ? 'app-shell app-shell-drawer-open' : 'app-shell'}>
      <aside className="sidebar" aria-label="Thanh điều hướng">
        <div className="sidebar-brand">
          <Link to="/">GastroCare</Link>
        </div>
        <AppSidebar role={user.role} onNavigate={() => setDrawerOpen(false)} />
        <div className="sidebar-footer">
          <span className="user-role">{roleLabel[user.role] ?? user.role}</span>
          <span className="user-email">{user.email}</span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </aside>

      {drawerOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Đóng menu"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="btn btn-ghost topbar-menu-btn"
            aria-label="Mở menu"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            ☰
          </button>
          <span className="brand">GastroCare</span>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
