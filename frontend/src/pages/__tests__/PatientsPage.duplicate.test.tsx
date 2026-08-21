import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PatientsPage } from '../PatientsPage';
import { patientsApi } from '../../api/resources';

vi.mock('../../api/resources', () => ({
  patientsApi: {
    list: vi.fn(),
    checkDuplicates: vi.fn(),
    create: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(patientsApi.list).mockResolvedValue([]);
});

describe('PatientsPage — duplicate warning behavior', () => {
  it('surfaces duplicate candidates without auto-merging, and still allows explicit create', async () => {
    vi.mocked(patientsApi.checkDuplicates).mockResolvedValue([
      {
        id: 'existing-1',
        fullName: 'Nguyễn Văn Minh',
        dateOfBirth: '1984-03-15',
        gender: 'MALE',
        phone: '0901234567',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(patientsApi.create).mockResolvedValue({
      patient: {
        id: 'new-1',
        fullName: 'Nguyễn Văn Minh',
        dateOfBirth: '1984-03-15',
        gender: 'MALE',
        phone: '0901234567',
        createdAt: '2026-08-21T00:00:00.000Z',
        updatedAt: '2026-08-21T00:00:00.000Z',
      },
      possibleDuplicates: [],
    });

    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '+ Bệnh nhân mới' }));

    await user.type(screen.getByLabelText('Họ tên'), 'Nguyễn Văn Minh');
    await user.type(screen.getByLabelText('Ngày sinh'), '1984-03-15');
    await user.type(screen.getByLabelText('Điện thoại'), '0901234567');

    await user.click(screen.getByRole('button', { name: /kiểm tra trùng lặp/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/có thể trùng/i);
    expect(screen.getByText(/Nguyễn Văn Minh — 15\/3\/1984 — 0901234567/)).toBeInTheDocument();

    // The warning never auto-merges — an explicit "create new anyway" action
    // must still be present and usable.
    const createButton = screen.getByRole('button', { name: 'Tạo bệnh nhân mới' });
    expect(createButton).toBeEnabled();
    await user.click(createButton);

    await waitFor(() => {
      expect(patientsApi.create).toHaveBeenCalled();
    });
  });
});
