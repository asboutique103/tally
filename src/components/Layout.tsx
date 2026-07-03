import {
  Building2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  BookOpenCheck,
  ShieldCheck,
  ScrollText,
  CreditCard,
  LayoutDashboard,
  Menu,
  Package,
  PackageCheck,
  PackageMinus,
  ReceiptText,
  Settings,
  Truck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { useAuth } from '../store/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/materials', label: 'Materials & Stock', icon: Package },
  { to: '/receipts', label: 'Material Received', icon: PackageCheck },
  { to: '/supplies', label: 'Material Supplied', icon: PackageMinus },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/stock-ledger', label: 'Stock Ledger', icon: ScrollText },
  { to: '/sites', label: 'Sites & Projects', icon: Building2 },
  { to: '/bills', label: 'Bills & Invoices', icon: ReceiptText },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/accounts', label: 'Accounts & Vouchers', icon: BookOpenCheck },
  { to: '/reports', label: 'Reports & Ledgers', icon: ClipboardList },
  { to: '/audit', label: 'Audit Trail', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data } = useApp();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Building2 size={23} /></div>
          <div><strong>ConstructFlow</strong><span>Ledger & Materials</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)}><X size={20} /></button>
        </div>
        <nav className="nav-list">
          <span className="nav-label">Workspace</span>
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="health-dot" />
          <div><strong>Enterprise local mode</strong><span>Accounting + stock integrated</span></div>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
            <div className="company-chip"><CircleDollarSign size={17} /><span>{data.settings.companyName}</span></div>
          </div>
          <div className="topbar-right">
            <div className="notification-pill"><Package size={16} /><span>{data.materials.length} materials</span></div>
            <button className="profile-button" onClick={handleLogout} title="Sign out">
              <span className="avatar">AR</span>
              <span className="profile-copy"><strong>Admin</strong><small>Sign out</small></span>
              <ChevronDown size={16} />
            </button>
          </div>
        </header>
        <div className="content-area"><Outlet /></div>
      </main>
    </div>
  );
}
