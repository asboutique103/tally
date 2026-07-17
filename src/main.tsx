import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { configurationError } from './lib/supabase';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {configurationError ? (
        <div className="workspace-gate" role="alert">
          <div className="workspace-gate-card">
            <strong>Production configuration required</strong>
            <p>{configurationError}</p>
            <p>Set the required public environment variables in the hosting project, then redeploy.</p>
          </div>
        </div>
      ) : <App />}
    </ErrorBoundary>
  </StrictMode>,
);
