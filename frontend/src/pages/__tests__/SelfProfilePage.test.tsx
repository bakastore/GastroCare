import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SelfProfilePage } from '../SelfProfilePage';
import { staffApi } from '../../api/resources';

const renderPage = () =>
  render(
    <MemoryRouter>
      <SelfProfilePage />
    </MemoryRouter>,
  );

vi.mock('../../api/resources', () => ({
  staffApi: { getSelfProfile: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('SelfProfilePage', () => {
  it('renders read-only self profile with no edit controls', async () => {
    vi.mocked(staffApi.getSelfProfile).mockResolvedValue({
      account: {
        userId: 'u1',
        email: 'me@dec019.example.test',
        displayName: 'Me',
        role: 'NURSE',
        isClinicAdmin: false,
        status: 'ACTIVE',
      },
      profile: {
        id: 'p1',
        authUserId: 'u1',
        fullName: 'Tran Thi B',
        professionalTitle: null,
        workPhone: null,
        primarySpecialty: 'GASTROENTEROLOGY',
        secondarySpecialties: [],
        specialtyOtherLabel: null,
        biography: null,
        createdAt: '',
        updatedAt: '',
      },
      credentials: [
        {
          id: 'c1',
          staffProfileId: 'p1',
          credentialType: 'LICENSE',
          name: 'CCHN',
          credentialNumber: null,
          issuingOrganization: null,
          issueDate: null,
          expiryDate: '2999-01-01',
          status: 'ACTIVE',
          effectiveStatus: 'ACTIVE',
          note: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText(/Tran Thi B/)).toBeInTheDocument();
    expect(screen.getByText(/CCHN/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lưu/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('handles the no-profile case', async () => {
    vi.mocked(staffApi.getSelfProfile).mockResolvedValue({
      account: {
        userId: 'u1',
        email: 'me@dec019.example.test',
        displayName: null,
        role: 'DOCTOR',
        isClinicAdmin: false,
        status: 'ACTIVE',
      },
      profile: null,
      credentials: [],
    });
    renderPage();
    expect(
      await screen.findByText('Chưa có hồ sơ nghề nghiệp.'),
    ).toBeInTheDocument();
  });
});
