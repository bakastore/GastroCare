import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/resources';
import { clearStoredToken, getStoredToken, onUnauthorized, setStoredToken } from '../api/client';
import { decodeJwtClaims, isExpired } from './jwt';
import type { AuthRole } from '../types/domain';

export interface CurrentUser {
  userId: string;
  tenantId: string;
  email: string;
  role: AuthRole;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function userFromToken(token: string): CurrentUser | null {
  const claims = decodeJwtClaims(token);
  if (!claims || isExpired(claims)) {
    return null;
  }
  return {
    userId: claims.sub,
    tenantId: claims.tenantId,
    email: claims.email,
    role: claims.role,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const logout = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  useEffect(() => {
    const existingToken = getStoredToken();
    if (existingToken) {
      const restoredUser = userFromToken(existingToken);
      if (restoredUser) {
        setUser(restoredUser);
      } else {
        clearStoredToken();
      }
    }
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    onUnauthorized(() => {
      clearStoredToken();
      setUser(null);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await authApi.login(email, password);
    const loggedInUser = userFromToken(accessToken);
    if (!loggedInUser) {
      throw new Error('Phiên đăng nhập không hợp lệ.');
    }
    setStoredToken(accessToken);
    setUser(loggedInUser);
  }, []);

  const value = useMemo(
    () => ({ user, isInitializing, login, logout }),
    [user, isInitializing, login, logout],
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
