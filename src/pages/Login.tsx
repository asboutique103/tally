import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Building2, Lock, User } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

export function Login() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAuthenticated) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const result = await login(username.trim(), password);
    if (!result.ok) {
      setError(result.error ?? 'Invalid username or password.');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark"><Building2 size={24} /></div>
          <div>
            <strong>ConstructFlow</strong>
            <span>Ledger & Materials</span>
          </div>
        </div>

        <h1>Sign in</h1>
        <p className="login-subtitle">{isSupabaseConfigured ? 'Use your Supabase Auth email and password to access the cloud workspace.' : 'Enter your local fallback credentials to access the workspace.'}</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-field">
            <span>{isSupabaseConfigured ? 'Email' : 'Username'}</span>
            <div className="login-input">
              <User size={18} />
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={isSupabaseConfigured ? 'owner@company.com' : 'Admin'}
                autoFocus
                autoComplete="username"
              />
            </div>
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="login-input">
              <Lock size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-submit">Sign in</button>
        </form>
      </div>
    </div>
  );
}
