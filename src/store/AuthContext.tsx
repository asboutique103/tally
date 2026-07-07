import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const AUTH_KEY = 'constructflow-auth-v3';

interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

interface LoginResult {
  ok: boolean;
  username: string | null;
  role: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => Boolean(sessionStorage.getItem(AUTH_KEY)),
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, error: 'Supabase login is not configured.' };
    }

    const { data, error } = await supabase.rpc('login_app_user', {
      p_username: username,
      p_password: password,
    });

    if (error) {
      console.error('Unable to verify app login', error.message);
      return { ok: false, error: 'Login setup is incomplete. Run the latest Supabase SQL.' };
    }

    const result = (Array.isArray(data) ? data[0] : data) as LoginResult | undefined;
    if (result?.ok) {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify({
        username: result.username ?? username,
        role: result.role ?? 'Admin',
      }));
      setIsAuthenticated(true);
      return { ok: true };
    }

    return { ok: false, error: 'Invalid username or password.' };
  };

  const logout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
