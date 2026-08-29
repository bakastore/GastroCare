import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import * as AuthContextModule from './auth/AuthContext';
import { makeCurrentUser } from './test/currentUser';

describe('App — unknown route shows a safe 404, not a blank page', () => {
  it('renders NotFoundPage for an unmatched path for a logged-in doctor', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: makeCurrentUser({ email: 'doctor.a@example.test', role: 'DOCTOR' }),
      isInitializing: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/this-path-does-not-exist']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText('Không tìm thấy trang.')).toBeInTheDocument();
  });
});
