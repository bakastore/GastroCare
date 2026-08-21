import { useCallback, useEffect, useState } from 'react';
import { ApiError } from './client';

interface QueryState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

// Small shared loading/error pattern so every page handles the same states
// consistently (Owner Execution Contract section 22).
export function useApiQuery<T>(
  loader: () => Promise<T>,
  deps: unknown[],
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    loader()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Có lỗi xảy ra. Vui lòng thử lại.');
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  return { data, isLoading, error, reload };
}
