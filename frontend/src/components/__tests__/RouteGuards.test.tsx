import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RequireClinicAdmin, RequireRole } from '../RouteGuards';
import { NotAuthorizedPage } from '../../pages/NotAuthorizedPage';
import * as AuthContextModule from '../../auth/AuthContext';
import { makeCurrentUser } from '../../test/currentUser';

function mockUser(
  role: 'DOCTOR' | 'RECEPTIONIST',
  overrides: Partial<ReturnType<typeof makeCurrentUser>> = {},
) {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: makeCurrentUser({ email: 'x@example.test', role, ...overrides }),
    isInitializing: false,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
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

describe('RequireClinicAdmin — DEC-018 capability gate', () => {
  function renderClinicAdminRoute() {
    return render(
      <MemoryRouter initialEntries={['/clinic-admin/users']}>
        <Routes>
          <Route path="/not-authorized" element={<NotAuthorizedPage />} />
          <Route element={<RequireClinicAdmin />}>
            <Route
              path="/clinic-admin/users"
              element={<div>Clinic admin content</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it('lets a user WITH the Clinic Admin capability through', () => {
    mockUser('RECEPTIONIST', { isClinicAdmin: true });
    renderClinicAdminRoute();
    expect(screen.getByText('Clinic admin content')).toBeInTheDocument();
  });

  it('denies an ordinary DOCTOR without the capability', () => {
    mockUser('DOCTOR', { isClinicAdmin: false });
    renderClinicAdminRoute();
    expect(screen.queryByText('Clinic admin content')).not.toBeInTheDocument();
    expect(
      screen.getByText('Bạn không có quyền truy cập trang này.'),
    ).toBeInTheDocument();
  });
});
