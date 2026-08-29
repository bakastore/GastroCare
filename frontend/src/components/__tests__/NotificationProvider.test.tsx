import { render, screen, act, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationProvider,
  useNotification,
} from '../NotificationProvider';

function Harness() {
  const notify = useNotification();
  return (
    <div>
      <button onClick={() => notify.success('Đã lưu')}>ok</button>
      <button onClick={() => notify.error('Có lỗi')}>err</button>
      <button onClick={() => notify.info('Thông tin')}>info</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <NotificationProvider>
      <Harness />
    </NotificationProvider>,
  );
}

describe('NotificationProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a success toast in a polite live region and auto-dismisses it', () => {
    renderHarness();

    fireEvent.click(screen.getByText('ok'));
    const toast = screen.getByText('Đã lưu');
    expect(toast.closest('.toast-region')).toHaveAttribute('aria-live', 'polite');
    expect(toast.closest('[role="status"]')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('Đã lưu')).not.toBeInTheDocument();
  });

  it('keeps an error toast until dismissed via its close button, with role="alert"', () => {
    renderHarness();

    fireEvent.click(screen.getByText('err'));
    const toast = screen.getByText('Có lỗi');
    expect(toast.closest('[role="alert"]')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText('Có lỗi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByText('Có lỗi')).not.toBeInTheDocument();
  });

  it('supports info toasts and stacks multiple toasts', () => {
    renderHarness();

    fireEvent.click(screen.getByText('info'));
    fireEvent.click(screen.getByText('err'));
    expect(screen.getByText('Thông tin')).toBeInTheDocument();
    expect(screen.getByText('Có lỗi')).toBeInTheDocument();
  });

  it('useNotification is a safe no-op without a provider', () => {
    function Bare() {
      const notify = useNotification();
      notify.success('nothing renders, nothing throws');
      return <span>ok</span>;
    }
    expect(() => render(<Bare />)).not.toThrow();
  });
});
