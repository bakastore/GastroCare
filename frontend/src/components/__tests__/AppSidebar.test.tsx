import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppSidebar, navGroupsForRole } from '../AppSidebar';

function renderSidebar(role: 'DOCTOR' | 'RECEPTIONIST' | 'NURSE', path = '/today') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppSidebar role={role} />
    </MemoryRouter>,
  );
}

describe('AppSidebar — DEMO UI NAVIGATION v1', () => {
  it('DOCTOR: three groups with the locked items, in order', () => {
    renderSidebar('DOCTOR');

    expect(screen.getByText('Công việc')).toBeInTheDocument();
    expect(screen.getByText('Lâm sàng')).toBeInTheDocument();
    expect(screen.getByText('Quản trị')).toBeInTheDocument();

    for (const label of [
      'Hôm nay',
      'Theo dõi',
      'Bệnh nhân',
      'Đợt điều trị',
      'Cận lâm sàng',
      'Người dùng',
      'Cơ sở & phòng',
      'Mẫu biểu',
      'Nhật ký',
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('no Longo top-level menu item, no raw domain wording', () => {
    renderSidebar('DOCTOR');
    expect(screen.queryByRole('link', { name: /longo/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/workflowKind/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pathway/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ungrouped/i)).not.toBeInTheDocument();
    // Clinician-facing wording is used.
    expect(screen.getByRole('link', { name: 'Đợt điều trị' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cận lâm sàng' })).toBeInTheDocument();
  });

  it('active route is marked', () => {
    renderSidebar('DOCTOR', '/treatment-cases');
    const active = screen.getByRole('link', { name: 'Đợt điều trị' });
    expect(active).toHaveClass('sidebar-link-active');
    expect(screen.getByRole('link', { name: 'Hôm nay' })).not.toHaveClass('sidebar-link-active');
  });

  it('Bệnh nhân stays active on a patient detail sub-route', () => {
    renderSidebar('DOCTOR', '/patients/patient-1');
    expect(screen.getByRole('link', { name: 'Bệnh nhân' })).toHaveClass('sidebar-link-active');
  });

  it('RECEPTIONIST: no clinical work queue, no clinical-form admin', () => {
    renderSidebar('RECEPTIONIST', '/patients');
    expect(screen.getByRole('link', { name: 'Bệnh nhân' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Hôm nay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Theo dõi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Đợt điều trị' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mẫu biểu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nhật ký' })).not.toBeInTheDocument();
  });

  it('NURSE: only the assigned CLS queue', () => {
    renderSidebar('NURSE', '/investigations/assigned');
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Cận lâm sàng');
  });

  it('navGroupsForRole has at most two levels (group -> item)', () => {
    for (const role of ['DOCTOR', 'RECEPTIONIST', 'NURSE'] as const) {
      for (const group of navGroupsForRole(role)) {
        expect(Array.isArray(group.items)).toBe(true);
        for (const item of group.items) {
          expect(typeof item.to).toBe('string');
          expect(typeof item.label).toBe('string');
        }
      }
    }
  });
});
