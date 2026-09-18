import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, authPost, tokenStore } from '../api/client';
import type { AuthTokens, SessionUser } from '../api/types';
import { ROLE_PERMISSIONS, type Permission } from './permissions';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<{ devCode?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  loginWithPassword: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  can: (permission: Permission) => boolean;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore a session on load if a token is present.
    if (!tokenStore.access) {
      setLoading(false);
      return;
    }
    api
      .get<SessionUser>('/auth/me')
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const requestOtp = async (phone: string) => authPost<{ devCode?: string }>('/auth/otp/request', { phone });

  const verifyOtp = async (phone: string, code: string) => {
    const tokens = await authPost<AuthTokens>('/auth/otp/verify', { phone, code });
    tokenStore.set(tokens);
    setUser(tokens.user);
  };

  const loginWithPassword = async (phone: string, password: string) => {
    const tokens = await authPost<AuthTokens>('/auth/login', { phone, password });
    tokenStore.set(tokens);
    setUser(tokens.user);
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  const can = (permission: Permission): boolean =>
    !!user && ROLE_PERMISSIONS[user.role].includes(permission);

  const value = useMemo<AuthState>(
    () => ({ user, loading, requestOtp, verifyOtp, loginWithPassword, logout, can }),
    [user, loading],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
