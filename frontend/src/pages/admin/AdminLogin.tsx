import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/Admin.css';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [usr, setUsr] = useState('');
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: POST login
      const res = await fetch(`${BASE}/api/method/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': 'fetch',
        },
        body: JSON.stringify({ usr, pwd }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          (errData as { message?: string }).message || 'Invalid credentials.'
        );
      }

      const data = (await res.json()) as {
        home_page?: string;
        full_name?: string;
        message?: string;
      };

      // Step 2: Get logged-in user
      const userRes = await fetch(
        `${BASE}/api/method/frappe.auth.get_logged_user`,
        {
          credentials: 'include',
          headers: { 'X-Frappe-CSRF-Token': 'fetch' },
        }
      );
      const userData = (await userRes.json()) as { message: string };
      const loggedUser = userData.message;

      // Step 3: Check admin roles via Has Role doctype
      const roleRes = await fetch(
        `${BASE}/api/resource/Has Role?filters=[["parent","=","${encodeURIComponent(loggedUser)}"],["role","in","Administrator,System Manager"]]&fields=["role"]&limit=5`,
        {
          credentials: 'include',
          headers: { 'X-Frappe-CSRF-Token': 'fetch' },
        }
      );
      const roleData = (await roleRes.json()) as {
        data?: { role: string }[];
      };

      const isAdmin =
        (roleData.data && roleData.data.length > 0) ||
        loggedUser === 'Administrator';

      if (!isAdmin) {
        await fetch(`${BASE}/api/method/logout`, {
          method: 'POST',
          credentials: 'include',
        });
        setError('Access denied. Admin privileges required.');
        setLoading(false);
        return;
      }

      localStorage.setItem('admin_session', 'true');
      localStorage.setItem('admin_user', data.full_name || loggedUser);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Login failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        {/* Logo */}
        <div className="admin-login-logo">
          <div className="admin-login-logo-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p className="admin-login-title">SB Admin</p>
            <p className="admin-login-subtitle">Control Panel</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="admin-login-error">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-email">
              Email / Username
            </label>
            <input
              id="admin-email"
              type="text"
              className="admin-form-input"
              placeholder="administrator@example.com"
              value={usr}
              onChange={(e) => setUsr(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              className="admin-form-input"
              placeholder="••••••••"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="admin-btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '11px 18px', fontSize: 15 }}
            disabled={loading}
          >
            {loading ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ animation: 'spin 0.8s linear infinite' }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#94a3b8',
            marginTop: 24,
            marginBottom: 0,
          }}
        >
          Restricted to Administrator &amp; System Manager roles only.
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
