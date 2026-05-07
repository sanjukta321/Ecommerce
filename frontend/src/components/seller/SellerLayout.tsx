import { type ReactNode, useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useSiteConfig } from '../../context/SiteConfigContext';
import { BrandLogo } from '../BrandLogo';
import '../../styles/Seller.css';

interface SellerLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function SellerLayout({ children, title, subtitle }: SellerLayoutProps) {
  const navigate = useNavigate();
  const { app_name } = useSiteConfig();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
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

  // Reset nav scroll when path changes to ensure top items are visible
  useEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  const session = localStorage.getItem('seller_session');
  if (!session) {
    return <Navigate to="/seller/login" replace />;
  }

  const user = localStorage.getItem('seller_user') || 'Seller';
  const initials = user.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  const handleLogout = () => {
    // Only clear seller session — customer session stays active so they can still shop
    localStorage.removeItem('seller_session');
    localStorage.removeItem('seller_user');
    navigate('/');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const toggleDropdown = () => {
    setProfileOpen(o => !o);
  };

  return (
    <>
      <div className="seller-layout">
        {/* Overlay for mobile */}
        <div
          className={`seller-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
          onClick={closeSidebar}
        />

        {/* Sidebar */}
        <aside className={`seller-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="seller-sidebar-logo">
            <div><BrandLogo appName={app_name} size="sm" /></div>
          </div>

          <nav className="seller-nav" ref={navRef}>
            <div className="seller-nav-section">Main Menu</div>

            <NavLink
              to="/seller/dashboard"
              className={({ isActive }) => `seller-nav-link${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
              Dashboard
            </NavLink>

            <NavLink
              to="/seller/products"
              className={({ isActive }) => `seller-nav-link${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              Products
            </NavLink>

            <NavLink
              to="/seller/orders"
              className={({ isActive }) => `seller-nav-link${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              Orders
            </NavLink>

            <NavLink
              to="/seller/inventory"
              className={({ isActive }) => `seller-nav-link${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              Inventory
            </NavLink>

            <div className="seller-nav-section" style={{ marginTop: 12 }}>Reports</div>

            <NavLink
              to="/seller/analytics"
              className={({ isActive }) => `seller-nav-link${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Analytics
            </NavLink>

            <NavLink
              to="/seller/returns"
              className={({ isActive }) => `seller-nav-link${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.6" />
              </svg>
              Returns
            </NavLink>

            <NavLink
              to="/seller/payments"
              className={({ isActive }) => `seller-nav-link${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              Payments
            </NavLink>

            <div className="seller-nav-section" style={{ marginTop: 12 }}>System</div>

            <NavLink
              to="/"
              className="seller-nav-link"
              onClick={closeSidebar}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Back to Store
            </NavLink>

            <NavLink
              to="/seller/profile"
              className={({ isActive }) => `seller-nav-link${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              My Profile
            </NavLink>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="seller-nav-link"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
              </svg>
              Settings
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', opacity: 0.4 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </nav>

          <div className="seller-sidebar-bottom">
            <div className="seller-sidebar-user">
              <div className="seller-sidebar-avatar">{initials}</div>
              <div className="seller-sidebar-username" title={user}>{user}</div>
            </div>
            <button className="seller-logout-btn" onClick={handleLogout}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="seller-main">
          <header className="seller-header">
            <div className="seller-header-left">
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <div className="seller-header-right">
              <div className="seller-header-user" ref={avatarRef} style={{ position: 'relative' }}>
                <div
                  className="seller-header-avatar"
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
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Seller Account</div>
                    </div>
                    <div style={{ padding: '6px 0' }}>
                      {[
                        { label: 'My Profile', to: '/seller/profile' },
                        { label: 'My Settings', to: '/seller/settings' },
                        { label: 'Session Defaults', to: '/seller/session-defaults' },
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
                        { label: 'Apps', to: '/seller/apps' },
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
                className="seller-mobile-toggle"
                onClick={() => setSidebarOpen(o => !o)}
                aria-label="Toggle sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </header>

          <div className="seller-content">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
