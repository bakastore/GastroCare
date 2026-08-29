import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../AppShell';
import * as AuthContextModule from '../../auth/AuthContext';

function mockUser(role: 'DOCTOR' | 'RECEPTIONIST' | 'NURSE', logout = vi.fn()) {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: { userId: 'u1', tenantId: 't1', email: `${role.toLowerCase()}@example.test`, role },
    isInitializing: false,
    login: vi.fn(),
    logout,
  });
  return logout;
}

function renderShell(path = '/today') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/today" element={<div>Today content</div>} />
          <Route path="/patients" element={<div>Patients content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell — sidebar navigation', () => {
  it('renders the sidebar nav + content for DOCTOR', () => {
    mockUser('DOCTOR');
    renderShell();
    expect(screen.getByRole('link', { name: 'Hôm nay' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bệnh nhân' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Theo dõi' })).toBeInTheDocument();
    expect(screen.getByText('Today content')).toBeInTheDocument();
  });

  it('RECEPTIONIST sees no clinical work queue', () => {
    mockUser('RECEPTIONIST');
    renderShell('/patients');
    expect(screen.getByRole('link', { name: 'Bệnh nhân' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hôm nay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Theo dõi' })).not.toBeInTheDocument();
  });

  it('footer shows role, current user and a working logout', async () => {
    const logout = mockUser('DOCTOR');
    renderShell();
    expect(screen.getByText('Bác sĩ')).toBeInTheDocument();
    expect(screen.getByText('doctor@example.test')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('mobile menu button toggles the drawer state', async () => {
    mockUser('DOCTOR');
    renderShell();
    const toggle = screen.getByRole('button', { name: 'Mở menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.setup().click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders nothing but the outlet when unauthenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      isInitializing: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/login" element={<div>Login content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Login content')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).not.toBeInTheDocument();
  });
});
