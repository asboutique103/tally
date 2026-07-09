import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Bills } from './pages/Bills';
import { Materials } from './pages/Materials';
import { Payments } from './pages/Payments';
import { Receipts } from './pages/Receipts';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Sites } from './pages/Sites';
import { Suppliers } from './pages/Suppliers';
import { Supplies } from './pages/Supplies';
import { Accounts } from './pages/Accounts';
import { AuditTrail } from './pages/AuditTrail';
import { InventoryLedger } from './pages/InventoryLedger';
import { Attendance } from './pages/Attendance';
import { canRoleAccess, ROUTE_ACCESS } from './lib/access';
import { AppProvider } from './store/AppContext';
import { AuthProvider, useAuth } from './store/AuthContext';

function RequireAuth({ children }: { children: ReactElement }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="auth-loading">Loading workspace...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

function RequireRole({ path, children }: { path: string; children: ReactElement }) {
  const { role } = useAuth();
  if (!canRoleAccess(role, path)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

const page = (path: string, element: ReactElement) => <RequireRole path={path}>{element}</RequireRole>;

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={page('/', <Dashboard />)} />
            <Route path="materials" element={page('/materials', <Materials />)} />
            <Route path="receipts" element={page('/receipts', <Receipts />)} />
            <Route path="supplies" element={page('/supplies', <Supplies />)} />
            <Route path="suppliers" element={page('/suppliers', <Suppliers />)} />
            <Route path="sites" element={page('/sites', <Sites />)} />
            <Route path="bills" element={page('/bills', <Bills />)} />
            <Route path="payments" element={page('/payments', <Payments />)} />
            <Route path="stock-ledger" element={page('/stock-ledger', <InventoryLedger />)} />
            <Route path="accounts" element={page('/accounts', <Accounts />)} />
            <Route path="attendance" element={page('/attendance', <Attendance />)} />
            <Route path="reports" element={page('/reports', <Reports />)} />
            <Route path="audit" element={page('/audit', <AuditTrail />)} />
            <Route path="settings" element={page('/settings', <Settings />)} />
          </Route>
          <Route path="*" element={<Navigate to={Object.keys(ROUTE_ACCESS)[0]} replace />} />
        </Routes>
      </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
