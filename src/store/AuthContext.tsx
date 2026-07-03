import { createContext, useContext, useState, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AUTH_KEY = 'constructflow-auth';
const LOCAL_USERNAME = 'Admin';
const LOCAL_PASSWORD = 'Admin1234';

interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => sessionStorage.getItem(AUTH_KEY) === 'true',
  );
  const [loading] = useState(false);

  const login = async (username: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('verify_login', {
        p_username: username,
        p_password: password,
      });

      if (error) {
        return { ok: false, error: error.message };
      }
      if (data === true) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        setIsAuthenticated(true);
        return { ok: true };
      }
      return { ok: false, error: 'Invalid username or password.' };
    }

    // Local fallback mode (VITE_USE_SUPABASE=false): hardcoded credentials.
    const ok = username === LOCAL_USERNAME && password === LOCAL_PASSWORD;
    if (ok) {
      sessionStorage.setItem(AUTH_KEY, 'true');
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
