import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../AppShell';
import * as AuthContextModule from '../../auth/AuthContext';

function mockUser(role: 'DOCTOR' | 'RECEPTIONIST') {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: { userId: 'u1', tenantId: 't1', email: `${role.toLowerCase()}@example.test`, role },
    isInitializing: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/today']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/today" element={<div>Today content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell role-aware navigation', () => {
  it('shows Hôm nay / Bệnh nhân / Theo dõi for DOCTOR', () => {
    mockUser('DOCTOR');
    renderShell();
    expect(screen.getByRole('link', { name: 'Hôm nay' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bệnh nhân' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Theo dõi' })).toBeInTheDocument();
  });

  it('shows only Bệnh nhân for RECEPTIONIST — no clinical nav items', () => {
    mockUser('RECEPTIONIST');
    renderShell();
    expect(screen.getByRole('link', { name: 'Bệnh nhân' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hôm nay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Theo dõi' })).not.toBeInTheDocument();
  });
});
