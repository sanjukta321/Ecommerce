import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { frappeApi } from '../../api/frappe';
import '../../styles/Seller.css';

export default function SellerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await frappeApi.login(email, password);
      localStorage.setItem('seller_session', 'true');
      localStorage.setItem('seller_user', res.full_name || email);
      navigate('/seller/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Check credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="seller-login-page">
      <div className="seller-login-card">
        <div className="seller-login-logo">
          <div className="seller-login-logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>SB Seller</div>
            <div style={{ fontSize: 11, color: '#8a94a6', letterSpacing: '0.8px' }}>PORTAL</div>
          </div>
        </div>

        <h1 className="seller-login-title">Welcome back</h1>
        <p className="seller-login-subtitle">Sign in to manage your store</p>

        {error && (
          <div className="seller-login-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form className="seller-login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="seller-login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
          Seller portal powered by Frappe ERP
        </p>
      </div>
    </div>
  );
}
