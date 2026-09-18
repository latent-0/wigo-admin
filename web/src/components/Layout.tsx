import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Permission } from '../auth/permissions';

interface NavItem {
  to: string;
  label: string;
  permission: Permission;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', permission: 'kpi:read' },
  { to: '/riders', label: 'Riders', permission: 'rider:read' },
  { to: '/applications', label: 'Applications', permission: 'application:read' },
  { to: '/documents', label: 'Document Review', permission: 'document:read' },
  { to: '/payments', label: 'Payments', permission: 'payment:read' },
  { to: '/notifications', label: 'Notifications', permission: 'notification:read' },
  { to: '/audit', label: 'Audit Log', permission: 'audit:read' },
  { to: '/admin-users', label: 'Admin Users', permission: 'admin_user:read' },
];

export function Layout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">W</span>
          <span className="brand-text">WIGO Admin</span>
        </div>
        <nav>
          {NAV.filter((item) => can(item.permission)).map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="env-pill">Pilot · staging</div>
          <div className="user-chip">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{user?.role}</span>
            <button className="btn btn-ghost" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
