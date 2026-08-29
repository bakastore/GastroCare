import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

// DEC-018 — a small dependency-free toast system so every data-changing action
// can report PROCESSING / SUCCESS / ERROR consistently. success/info toasts
// auto-dismiss; error toasts stay until dismissed. The live region is
// aria-live="polite"; error toasts additionally use role="alert".

export type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface NotificationApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const NOOP: NotificationApi = {
  success: () => {},
  error: () => {},
  info: () => {},
};

const NotificationContext = createContext<NotificationApi>(NOOP);

/** Returns the toast API. Safe to call without a provider (no-op fallback). */
export function useNotification(): NotificationApi {
  return useContext(NotificationContext);
}

const AUTO_DISMISS_MS = 3500;
const KIND_LABEL: Record<ToastKind, string> = {
  success: 'Thành công',
  error: 'Lỗi',
  info: 'Thông báo',
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      seq.current += 1;
      const id = seq.current;
      setToasts((list) => [...list, { id, kind, message }]);
      if (kind !== 'error') {
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      }
    },
    [dismiss],
  );

  const api = useMemo<NotificationApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <NotificationContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.kind}`}
            role={t.kind === 'error' ? 'alert' : 'status'}
          >
            <span className="toast-kind">{KIND_LABEL[t.kind]}:</span>{' '}
            <span>{t.message}</span>
            {t.kind === 'error' && (
              <button
                type="button"
                className="toast-close"
                aria-label="Đóng thông báo"
                onClick={() => dismiss(t.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
