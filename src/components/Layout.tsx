import {
  Building2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  ClipboardList,
  BookOpenCheck,
  ShieldCheck,
  ScrollText,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  PackageMinus,
  ReceiptText,
  Settings,
  Truck,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { canRoleAccess } from '../lib/access';
import { isLocalModeEnabled, isSupabaseConfigured } from '../lib/supabase';
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
  { to: '/attendance', label: 'Staff & Attendance', icon: Users },
  { to: '/reports', label: 'Reports & Ledgers', icon: ClipboardList },
  { to: '/audit', label: 'Audit Trail', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { data } = useApp();
  const { logout, role, username } = useAuth();
  const navigate = useNavigate();
  const visibleNav = nav.filter((item) => canRoleAccess(role, item.to));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${mobileOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark brand-mark-logo"><img src="/logo.png" alt="VMV Enterprise" /></div>
          <div><strong>VMV Enterprise</strong><span>Building Today · Creating Tomorrow</span></div>
        </div>
        <nav className="nav-list">
          <span className="nav-label">Workspace</span>
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              data-tooltip={label}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className="icon-button sidebar-collapse-toggle"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
          <div className="health-dot" />
          <div><strong>{isSupabaseConfigured ? 'Supabase cloud mode' : 'Development local mode'}</strong><span>{isSupabaseConfigured ? 'Cloud data sync enabled' : isLocalModeEnabled ? 'Browser-only test data' : 'Configuration required'}</span></div>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
            <div className="company-chip"><CircleDollarSign size={17} /><span>{data.settings.companyName || 'Company not set'}</span></div>
          </div>
          <div className="topbar-right">
            <div className="notification-pill"><Package size={16} /><span>{data.materials.length} materials</span></div>
            <button className="profile-button">
              <span className="avatar">{(username || 'User').slice(0, 2).toUpperCase()}</span>
              <span className="profile-copy"><strong>{username || 'User'}</strong><small>{role ?? 'Signed in'}</small></span>
              <ChevronDown size={16} />
            </button>
            {isSupabaseConfigured && <button className="signout-button" onClick={handleLogout} title="Sign out" aria-label="Sign out">
              <LogOut size={17} />
              <span>Sign out</span>
            </button>}
          </div>
        </header>
        <div className="content-area"><Outlet /></div>
      </main>
    </div>
  );
}
