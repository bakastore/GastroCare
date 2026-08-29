import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FacilitiesRoomsPage } from '../FacilitiesRoomsPage';
import { NotificationProvider } from '../../../components/NotificationProvider';
import { facilitiesApi, roomsApi } from '../../../api/resources';

vi.mock('../../../api/resources', () => ({
  facilitiesApi: { list: vi.fn(), create: vi.fn() },
  roomsApi: { listByFacility: vi.fn(), create: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(facilitiesApi.list).mockResolvedValue([
    { id: 'f1', name: 'Cơ sở 1', createdAt: '2026-08-01' },
  ]);
  vi.mocked(roomsApi.listByFacility).mockResolvedValue([]);
});

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <FacilitiesRoomsPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

describe('FacilitiesRoomsPage (DEC-018)', () => {
  it('creates a facility — button shows processing, success toast, no double-submit', async () => {
    let resolve: () => void = () => {};
    vi.mocked(facilitiesApi.create).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = () =>
            r({ id: 'f2', name: 'Cơ sở mới', createdAt: 'x' });
        }),
    );
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('Cơ sở 1');

    await user.type(screen.getByLabelText('Tên cơ sở'), 'Cơ sở mới');
    await user.click(screen.getByRole('button', { name: 'Thêm cơ sở' }));

    const busy = screen.getByRole('button', { name: 'Đang xử lý…' });
    expect(busy).toBeDisabled();
    await user.click(busy);

    resolve();
    expect(await screen.findByText('Đã tạo cơ sở')).toBeInTheDocument();
    expect(facilitiesApi.create).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when facility creation fails', async () => {
    const { ApiError } = await import('../../../api/client');
    vi.mocked(facilitiesApi.create).mockRejectedValueOnce(
      new ApiError(403, 'Clinic Admin capability required'),
    );
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('Cơ sở 1');

    await user.type(screen.getByLabelText('Tên cơ sở'), 'X');
    await user.click(screen.getByRole('button', { name: 'Thêm cơ sở' }));

    await waitFor(() =>
      expect(
        screen.getAllByText('Clinic Admin capability required').length,
      ).toBeGreaterThan(0),
    );
  });

  it('creates a room under a facility with a success toast', async () => {
    vi.mocked(roomsApi.create).mockResolvedValueOnce({
      id: 'r1',
      name: 'Phòng 1',
      facilityId: 'f1',
      createdAt: 'x',
    });
    renderPage();
    const user = userEvent.setup();
    await screen.findByText('Cơ sở 1');

    await user.type(screen.getByLabelText('Tên phòng'), 'Phòng 1');
    await user.click(screen.getByRole('button', { name: 'Thêm phòng' }));

    expect(await screen.findByText('Đã tạo phòng')).toBeInTheDocument();
    expect(roomsApi.create).toHaveBeenCalledWith({
      facilityId: 'f1',
      name: 'Phòng 1',
    });
  });
});
