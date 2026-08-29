import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { PageHeader } from '../PageHeader';

function renderAt(path: string, ui: React.ReactNode, parentEl: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/here" element={ui} />
        <Route path="/patients" element={parentEl} />
        <Route path="/patients/:id" element={parentEl} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('PageHeader — contextual back + hierarchy', () => {
  it('back link points at the explicit parent route (not history)', async () => {
    renderAt(
      '/here',
      <PageHeader parentLabel="Danh sách bệnh nhân" parentHref="/patients" title="Chi tiết" />,
      <div>Patient list</div>,
    );
    const back = screen.getByRole('link', { name: 'Danh sách bệnh nhân' });
    expect(back).toHaveAttribute('href', '/patients');
    await userEvent.setup().click(back);
    expect(await screen.findByText('Patient list')).toBeInTheDocument();
  });

  it('renders breadcrumb with clickable ancestors and a non-link current item', () => {
    renderAt(
      '/here',
      <PageHeader
        parentLabel="Hồ sơ bệnh nhân"
        parentHref="/patients/p1"
        breadcrumb={[
          { label: 'Bệnh nhân', href: '/patients' },
          { label: 'BN A', href: '/patients/p1' },
          { label: 'Khám trĩ' },
        ]}
        title="Khám trĩ"
      />,
      <div>parent</div>,
    );
    expect(screen.getByRole('link', { name: 'Bệnh nhân' })).toHaveAttribute('href', '/patients');
    expect(screen.getByRole('link', { name: 'BN A' })).toHaveAttribute('href', '/patients/p1');
    // current crumb is not a link
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs).toHaveTextContent('Bệnh nhân / BN A / Khám trĩ');
  });

  it('title + status render together; status does not replace the heading', () => {
    renderAt(
      '/here',
      <PageHeader title="Khám trĩ" status={<span className="badge">Đã hoàn tất</span>} />,
      <div />,
    );
    expect(screen.getByRole('heading', { name: 'Khám trĩ' })).toBeInTheDocument();
    expect(screen.getByText('Đã hoàn tất')).toBeInTheDocument();
  });

  it('completed / read-only (no guard): back navigates with no confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderAt(
      '/here',
      <PageHeader parentLabel="Hồ sơ bệnh nhân" parentHref="/patients/p1" title="X" />,
      <div>patient p1</div>,
    );
    await userEvent.setup().click(screen.getByRole('link', { name: 'Hồ sơ bệnh nhân' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByText('patient p1')).toBeInTheDocument();
  });

  it('dirty guard: asks before leaving; staying keeps the page', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt(
      '/here',
      <PageHeader
        parentLabel="Hồ sơ bệnh nhân"
        parentHref="/patients/p1"
        title="X"
        guardUnsavedChanges
      />,
      <div>patient p1</div>,
    );
    await userEvent.setup().click(screen.getByRole('link', { name: 'Hồ sơ bệnh nhân' }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('patient p1')).toBeNull();
  });

  it('dirty guard: confirming leaves the page', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt(
      '/here',
      <PageHeader
        parentLabel="Hồ sơ bệnh nhân"
        parentHref="/patients/p1"
        title="X"
        guardUnsavedChanges
      />,
      <div>patient p1</div>,
    );
    await userEvent.setup().click(screen.getByRole('link', { name: 'Hồ sơ bệnh nhân' }));
    expect(await screen.findByText('patient p1')).toBeInTheDocument();
  });
});
