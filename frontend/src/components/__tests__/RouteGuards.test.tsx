import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireRole } from '../RouteGuards';
import { NotAuthorizedPage } from '../../pages/NotAuthorizedPage';
import * as AuthContextModule from '../../auth/AuthContext';

function mockUser(role: 'DOCTOR' | 'RECEPTIONIST') {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: { userId: 'u1', tenantId: 't1', email: 'x@example.test', role },
    isInitializing: false,
    login: vi.fn(),
    logout: vi.fn(),
  });
}

function renderDoctorOnlyRoute() {
  return render(
    <MemoryRouter initialEntries={['/follow-up']}>
      <Routes>
        <Route path="/not-authorized" element={<NotAuthorizedPage />} />
        <Route element={<RequireRole allowed={['DOCTOR']} />}>
          <Route path="/follow-up" element={<div>Follow-up queue (doctor only)</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole — doctor/receptionist authorization presentation', () => {
  it('lets a DOCTOR through to a doctor-only route', () => {
    mockUser('DOCTOR');
    renderDoctorOnlyRoute();
    expect(screen.getByText('Follow-up queue (doctor only)')).toBeInTheDocument();
  });

  it('shows an access-denied state for a RECEPTIONIST on a doctor-only route, not the clinical content', () => {
    mockUser('RECEPTIONIST');
    renderDoctorOnlyRoute();
    expect(screen.queryByText('Follow-up queue (doctor only)')).not.toBeInTheDocument();
    expect(screen.getByText('Bạn không có quyền truy cập trang này.')).toBeInTheDocument();
  });
});
