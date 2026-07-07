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

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="materials" element={<Materials />} />
            <Route path="receipts" element={<Receipts />} />
            <Route path="supplies" element={<Supplies />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="sites" element={<Sites />} />
            <Route path="bills" element={<Bills />} />
            <Route path="payments" element={<Payments />} />
            <Route path="stock-ledger" element={<InventoryLedger />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="reports" element={<Reports />} />
            <Route path="audit" element={<AuditTrail />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}
