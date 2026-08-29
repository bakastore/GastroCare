import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppSidebar, navGroupsFor } from '../AppSidebar';

function renderSidebar(
  role: 'DOCTOR' | 'RECEPTIONIST' | 'NURSE',
  { path = '/today', isClinicAdmin = false } = {},
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppSidebar role={role} isClinicAdmin={isClinicAdmin} />
    </MemoryRouter>,
  );
}

describe('AppSidebar — DEMO UI NAVIGATION v1 (DEC-017) + DEC-018 admin boundary', () => {
  it('DOCTOR without the Clinic Admin capability: clinical-first groups, NO "Quản trị"', () => {
    renderSidebar('DOCTOR');

    expect(screen.getByText('Công việc')).toBeInTheDocument();
    expect(screen.getByText('Lâm sàng')).toBeInTheDocument();
    expect(screen.getByText('Tiện ích')).toBeInTheDocument();
    expect(screen.queryByText('Quản trị')).not.toBeInTheDocument();

    for (const label of [
      'Hôm nay',
      'Theo dõi',
      'Bệnh nhân',
      'Đợt điều trị',
      'Cận lâm sàng',
      'Mẫu biểu',
      'Nhật ký',
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(
      screen.queryByRole('link', { name: 'Người dùng' }),
    ).not.toBeInTheDocument();
  });

  it('DEC-018 — the Clinic Admin capability adds "Quản trị" with /clinic-admin/* items, for any role', () => {
    for (const role of ['DOCTOR', 'NURSE', 'RECEPTIONIST'] as const) {
      const { unmount } = renderSidebar(role, { isClinicAdmin: true });
      expect(screen.getByText('Quản trị')).toBeInTheDocument();
      const users = screen.getByRole('link', { name: 'Người dùng' });
      const facilities = screen.getByRole('link', { name: 'Cơ sở & phòng' });
      expect(users).toHaveAttribute('href', '/clinic-admin/users');
      expect(facilities).toHaveAttribute('href', '/clinic-admin/facilities');
      unmount();
    }
  });

  it('no legacy /admin/users or /admin/facilities link anywhere', () => {
    renderSidebar('DOCTOR', { isClinicAdmin: true });
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toBe('/admin/users');
      expect(link.getAttribute('href')).not.toBe('/admin/facilities');
    }
  });

  it('no Longo top-level menu item, no raw domain wording', () => {
    renderSidebar('DOCTOR');
    expect(screen.queryByRole('link', { name: /longo/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/workflowKind/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pathway/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đợt điều trị' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cận lâm sàng' })).toBeInTheDocument();
  });

  it('active route is marked', () => {
    renderSidebar('DOCTOR', { path: '/treatment-cases' });
    expect(
      screen.getByRole('link', { name: 'Đợt điều trị' }),
    ).toHaveClass('sidebar-link-active');
    expect(screen.getByRole('link', { name: 'Hôm nay' })).not.toHaveClass(
      'sidebar-link-active',
    );
  });

  it('Bệnh nhân stays active on a patient detail sub-route', () => {
    renderSidebar('DOCTOR', { path: '/patients/patient-1' });
    expect(screen.getByRole('link', { name: 'Bệnh nhân' })).toHaveClass(
      'sidebar-link-active',
    );
  });

  it('RECEPTIONIST without capability: only patient lookup', () => {
    renderSidebar('RECEPTIONIST', { path: '/patients' });
    expect(screen.getByRole('link', { name: 'Bệnh nhân' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hôm nay' })).not.toBeInTheDocument();
    expect(screen.queryByText('Quản trị')).not.toBeInTheDocument();
  });

  it('NURSE without capability: only the assigned CLS queue', () => {
    renderSidebar('NURSE', { path: '/investigations/assigned' });
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Cận lâm sàng');
  });

  it('navGroupsFor has at most two levels (group -> item)', () => {
    for (const role of ['DOCTOR', 'RECEPTIONIST', 'NURSE'] as const) {
      for (const admin of [false, true]) {
        for (const group of navGroupsFor(role, admin)) {
          expect(Array.isArray(group.items)).toBe(true);
          for (const item of group.items) {
            expect(typeof item.to).toBe('string');
            expect(typeof item.label).toBe('string');
          }
        }
      }
    }
  });
});
