import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isLocalModeEnabled, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Role } from '../types';

const AUTH_KEY = 'constructflow-auth-v4';
const LOCAL_USER: AuthUser = { sessionToken: 'local-workspace', username: 'Local Owner', role: 'Owner' };

interface AuthUser {
  sessionToken: string;
  username: string;
  role: Role;
  expiresAt?: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  username: string;
  role: Role | null;
  sessionToken: string | null;
  canAccess: (allowedRoles?: Role[]) => boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

interface LoginResult {
  ok: boolean;
  username?: string | null;
  role?: string | null;
  session_token?: string | null;
  sessionToken?: string | null;
  expires_at?: string | null;
  expiresAt?: string | null;
  message?: string | null;
}

const roleMap: Record<string, Role> = {
  owner: 'Owner',
  admin: 'Admin',
  accountant: 'Accountant',
  storekeeper: 'Storekeeper',
  site_engineer: 'Site Engineer',
  viewer: 'Viewer',
};

const normalizeRole = (value?: string | null): Role => roleMap[(value ?? '').toLowerCase().replaceAll(' ', '_')] ?? 'Viewer';

const parseStoredAuth = (): AuthUser | null => {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.sessionToken || !parsed.username) return null;
    return {
      sessionToken: parsed.sessionToken,
      username: parsed.username,
      role: normalizeRole(parsed.role),
      expiresAt: parsed.expiresAt,
    };
  } catch {
    sessionStorage.removeItem(AUTH_KEY);
    return null;
  }
};

const storeAuth = (auth: AuthUser) => sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => isSupabaseConfigured ? parseStoredAuth() : isLocalModeEnabled ? LOCAL_USER : null);
  const [loading, setLoading] = useState(() => Boolean(isSupabaseConfigured && parseStoredAuth()));

  useEffect(() => {
    const stored = parseStoredAuth();
    if (!stored || !isSupabaseConfigured || !supabase) {
      if (isLocalModeEnabled) {
        sessionStorage.removeItem(AUTH_KEY);
        setAuthUser(LOCAL_USER);
      } else {
        setAuthUser(null);
      }
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('get_app_session', { p_session_token: stored.sessionToken });
        if (cancelled) return;
        const result = (Array.isArray(data) ? data[0] : data) as LoginResult | undefined;
        if (error || !result?.ok) {
          sessionStorage.removeItem(AUTH_KEY);
          setAuthUser(null);
        } else {
          const verified: AuthUser = {
            sessionToken: stored.sessionToken,
            username: result.username ?? stored.username,
            role: normalizeRole(result.role ?? stored.role),
            expiresAt: result.expires_at ?? result.expiresAt ?? stored.expiresAt,
          };
          storeAuth(verified);
          setAuthUser(verified);
        }
        setLoading(false);
      } catch {
        if (cancelled) return;
        sessionStorage.removeItem(AUTH_KEY);
        setAuthUser(null);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const login = async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    if (isLocalModeEnabled) {
      setAuthUser(LOCAL_USER);
      return { ok: true };
    }
    if (!isSupabaseConfigured || !supabase) return { ok: false, error: 'The production database is not configured.' };

    let data: unknown;
    let error: { message: string } | null;
    try {
      const response = await supabase.rpc('login_app_user', { p_username: username, p_password: password });
      data = response.data;
      error = response.error;
    } catch {
      return { ok: false, error: 'Unable to reach the sign-in service. Check your connection and try again.' };
    }

    if (error) {
      console.error('Unable to verify app login', error.message);
      return { ok: false, error: 'Login setup is incomplete. Run the latest Supabase SQL.' };
    }

    const result = (Array.isArray(data) ? data[0] : data) as LoginResult | undefined;
    const sessionToken = result?.session_token ?? result?.sessionToken;
    if (!result?.ok || !sessionToken) {
      return { ok: false, error: result?.message ?? 'Invalid username or password.' };
    }

    const nextUser: AuthUser = {
      sessionToken,
      username: result.username ?? username,
      role: normalizeRole(result.role),
      expiresAt: result.expires_at ?? result.expiresAt ?? undefined,
    };
    storeAuth(nextUser);
    setAuthUser(nextUser);
    return { ok: true };
  };

  const logout = () => {
    if (isLocalModeEnabled) {
      setAuthUser(LOCAL_USER);
      return;
    }
    const token = authUser?.sessionToken;
    sessionStorage.removeItem(AUTH_KEY);
    setAuthUser(null);
    if (token && isSupabaseConfigured && supabase) {
      void supabase.rpc('logout_app_user', { p_session_token: token });
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, error: 'Password management is available only when cloud sync is enabled.' };
    }
    if (!authUser?.sessionToken) return { ok: false, error: 'Your session has expired. Sign in again.' };
    if (newPassword.length < 12) return { ok: false, error: 'The new password must contain at least 12 characters.' };

    try {
      const { data, error } = await supabase.rpc('change_app_password', {
        p_session_token: authUser.sessionToken,
        p_current_password: currentPassword,
        p_new_password: newPassword,
      });
      if (error) return { ok: false, error: 'The password could not be changed. Run the latest Supabase SQL and try again.' };
      const result = (Array.isArray(data) ? data[0] : data) as { ok?: boolean; message?: string | null } | undefined;
      if (!result?.ok) return { ok: false, error: result?.message ?? 'The current password is incorrect.' };
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach the password service. Check your connection and try again.' };
    }
  };

  const value: AuthContextValue = {
    isAuthenticated: Boolean(authUser),
    loading,
    username: authUser?.username ?? '',
    role: authUser?.role ?? null,
    sessionToken: authUser?.sessionToken ?? null,
    canAccess: (allowedRoles?: Role[]) => Boolean(authUser && (!allowedRoles?.length || allowedRoles.includes(authUser.role))),
    login,
    changePassword,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
