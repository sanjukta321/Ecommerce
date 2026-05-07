import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate, Navigate } from 'react-router-dom';
import { frappeApi } from '../../api/frappe';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { BrandLogo } from '../BrandLogo';
import '../../styles/Admin.css';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { app_name } = useSiteConfig();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    setProfileOpen(o => !o);
  };

  const session = localStorage.getItem('admin_session');
  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  const user = localStorage.getItem('admin_user') || 'Administrator';
  const initials = user.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = async () => {
    try { await frappeApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('admin_session');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const navLink = (to: string, label: string, icon: ReactNode) => (
    <NavLink
      to={to}
      className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
      onClick={closeSidebar}
    >
      {icon}
      {label}
    </NavLink>
  );

  return (
    <>
      <div className="admin-layout">
        <div
          className={`admin-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={closeSidebar}
        />

        <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="admin-sidebar-logo">
            <div style={{ color: '#fff' }}><BrandLogo appName={app_name} size="sm" /></div>
          </div>

          <nav className="admin-nav">
            <div className="admin-nav-section">Overview</div>

            {navLink('/admin/dashboard', 'Dashboard',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            )}

            <div className="admin-nav-section" style={{ marginTop: 8 }}>Manage</div>

            {navLink('/admin/products', 'Products',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            )}

            {navLink('/admin/orders', 'Orders',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            )}

            {navLink('/admin/sellers', 'Sellers',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            )}

            {navLink('/admin/customers', 'Customers',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}

            <div className="admin-nav-section" style={{ marginTop: 8 }}>Reports</div>

            {navLink('/admin/reports', 'Analytics & Reports',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            )}

            <div className="admin-nav-section" style={{ marginTop: 8 }}>System</div>

            {navLink('/admin/settings', 'Settings',
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
              </svg>
            )}
          </nav>

          <div className="admin-sidebar-bottom">
            <div className="admin-sidebar-user">
              <div className="admin-sidebar-avatar">{initials}</div>
              <div className="admin-sidebar-username" title={user}>{user}</div>
            </div>
            <button className="admin-logout-btn" onClick={handleLogout} title="Logout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </aside>

        <main className="admin-main">
          <header className="admin-header">
            <div>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <div className="admin-header-right">
              <div ref={avatarRef} style={{ position: 'relative' }}>
                <div
                  className="admin-header-avatar"
                  onClick={toggleDropdown}
                  style={{ cursor: 'pointer' }}
                  title={user}
                >
                  {initials}
                </div>
                {profileOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 8,
                    background: '#1e2535', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    minWidth: 200, zIndex: 999, overflow: 'hidden',
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{user}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Administrator</div>
                    </div>
                    <div style={{ padding: '6px 0' }}>
                      {[
                        { label: 'My Profile', to: '/admin/profile' },
                        { label: 'My Settings', to: '/admin/settings' },
                        { label: 'Session Defaults', to: '/admin/session-defaults' },
                      ].map((item) => (
                        <div
                          key={item.label}
                          onClick={() => { setProfileOpen(false); navigate(item.to); }}
                          style={{
                            padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                            color: 'rgba(255,255,255,0.85)', transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '6px 0' }}>
                      {[
                        { label: 'Reload', onClick: () => window.location.reload() },
                        { label: 'View Website', to: '/' },
                        { label: 'Toggle Full Width', to: '#' },
                        { label: 'Apps', to: '/admin/apps' },
                      ].map((item) => (
                        <div
                          key={item.label}
                          onClick={() => {
                            setProfileOpen(false);
                            if (item.onClick) item.onClick();
                            else if (item.to && item.to !== '#') navigate(item.to);
                          }}
                          style={{
                            padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                            color: 'rgba(255,255,255,0.85)', transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {item.label}
                        </div>
                      ))}
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '6px 0' }}>
                      <div
                        onClick={() => { setProfileOpen(false); }}
                        style={{
                          padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                          color: 'rgba(255,255,255,0.85)', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        Toggle Theme
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div
                        onClick={() => { setProfileOpen(false); handleLogout(); }}
                        style={{
                          padding: '10px 16px', cursor: 'pointer', fontSize: 14,
                          color: '#f87171', fontWeight: 600,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        Logout
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                className="admin-mobile-toggle"
                onClick={() => setSidebarOpen(o => !o)}
                aria-label="Toggle sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </header>
          <div className="admin-content">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
