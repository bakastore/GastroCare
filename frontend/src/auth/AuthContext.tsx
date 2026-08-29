import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/resources';
import type { AuthMe } from '../api/resources';
import {
  ApiError,
  clearStoredToken,
  getStoredToken,
  onUnauthorized,
  setStoredToken,
} from '../api/client';
import { isTokenUsable } from './jwt';
import type { AuthRole } from '../types/domain';

export interface CurrentUser {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string | null;
  role: AuthRole;
  isClinicAdmin: boolean;
  status: 'ACTIVE' | 'DISABLED';
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Re-fetch GET /auth/me — used after a password change bumps the token. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function toCurrentUser(me: AuthMe): CurrentUser {
  return {
    userId: me.userId,
    tenantId: me.tenantId,
    email: me.email,
    displayName: me.displayName,
    role: me.role,
    isClinicAdmin: me.isClinicAdmin,
    status: me.status,
    mustChangePassword: me.mustChangePassword,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    // DEC-018 — authority always comes from GET /auth/me, never the token.
    const me = await authApi.me();
    setUser(toCurrentUser(me));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = getStoredToken();
    if (!token || !isTokenUsable(token)) {
      clearStoredToken();
      setIsInitializing(false);
      return;
    }
    authApi
      .me()
      .then((me) => {
        if (!cancelled) {
          setUser(toCurrentUser(me));
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearStoredToken();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsInitializing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onUnauthorized(() => {
      clearStoredToken();
      setUser(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await authApi.login(email, password);
    setStoredToken(accessToken);
    try {
      const me = await authApi.me();
      setUser(toCurrentUser(me));
    } catch (err) {
      clearStoredToken();
      setUser(null);
      throw err instanceof ApiError
        ? err
        : new Error('Phiên đăng nhập không hợp lệ.');
    }
  }, []);

  const value = useMemo(
    () => ({ user, isInitializing, login, logout, refresh }),
    [user, isInitializing, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
