import { useState, useEffect } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface Supplier {
  name: string;
  supplier_name: string;
  supplier_type: string;
  website: string;
  creation: string;
}

interface FormState {
  supplier_name: string;
  supplier_type: string;
  website: string;
  email_id: string;
  mobile_no: string;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': 'fetch' },
    ...options,
  });
  return res.json() as Promise<T>;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function SellerProfile() {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [form, setForm] = useState<FormState>({
    supplier_name: '',
    supplier_type: 'Individual',
    website: '',
    email_id: '',
    mobile_no: '',
  });

  const username = localStorage.getItem('seller_user') || '';

  useEffect(() => {
    const loadSupplier = async () => {
      setLoading(true);
      try {
        const res = await apiFetch<{ data: Supplier[] }>(
          `/api/resource/Supplier?fields=["name","supplier_name","supplier_type","website","creation"]&filters=[["supplier_name","like","%${encodeURIComponent(username)}%"]]&limit=1`
        );
        const found = res.data?.[0] || null;
        if (!found) {
          setNotFound(true);
        } else {
          setSupplier(found);
          setForm({
            supplier_name: found.supplier_name || '',
            supplier_type: found.supplier_type || 'Individual',
            website: found.website || '',
            email_id: '',
            mobile_no: '',
          });
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    loadSupplier();
  }, [username]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setSaveSuccess(false);
    setSaveError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError('');
    try {
      await apiFetch(`/api/resource/Supplier/${encodeURIComponent(supplier.name)}`, {
        method: 'PUT',
        body: JSON.stringify({
          supplier_name: form.supplier_name,
          supplier_type: form.supplier_type,
          website: form.website,
        }),
      });
      setSupplier(prev => prev ? { ...prev, supplier_name: form.supplier_name, supplier_type: form.supplier_type, website: form.website } : prev);
      setSaveSuccess(true);
    } catch {
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SellerLayout title="Profile" subtitle="Manage your seller account details">

      {/* Profile Info Card */}
      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">Seller Profile</h2>
            <p className="seller-section-subtitle">Your account information</p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div className="seller-skeleton" style={{ width: 60, height: 60, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="seller-skeleton seller-skeleton-row" style={{ width: '40%', marginBottom: 10 }} />
                <div className="seller-skeleton seller-skeleton-row" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
        ) : notFound ? (
          <div className="seller-empty" style={{ padding: '40px 20px' }}>
            <div className="seller-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <h3>Supplier profile not linked</h3>
            <p>Supplier profile not linked to your account. Contact admin to set up your seller profile.</p>
          </div>
        ) : supplier && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '8px 0 20px' }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
              color: '#fff',
              flexShrink: 0,
              letterSpacing: 1,
            }}>
              {getInitials(supplier.supplier_name || username || 'S')}
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.3 }}>
                {supplier.supplier_name}
              </div>
              <div style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>
                {username}
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                Member since {formatDate(supplier.creation)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Form */}
      {!loading && !notFound && supplier && (
        <div className="seller-section">
          <div className="seller-section-header">
            <div>
              <h2 className="seller-section-title">Edit Profile</h2>
              <p className="seller-section-subtitle">Update your seller information</p>
            </div>
          </div>

          <form onSubmit={handleSave} style={{ maxWidth: 560 }}>
            <div className="seller-form-group">
              <label className="seller-form-label">Supplier Name</label>
              <input
                className="seller-form-input"
                type="text"
                name="supplier_name"
                value={form.supplier_name}
                onChange={handleChange}
                disabled={saving}
                placeholder="Enter supplier name"
                required
              />
            </div>

            <div className="seller-form-group">
              <label className="seller-form-label">Email Address</label>
              <input
                className="seller-form-input"
                type="email"
                name="email_id"
                value={form.email_id}
                onChange={handleChange}
                disabled={saving}
                placeholder="Enter email address"
              />
            </div>

            <div className="seller-form-group">
              <label className="seller-form-label">Mobile No</label>
              <input
                className="seller-form-input"
                type="tel"
                name="mobile_no"
                value={form.mobile_no}
                onChange={handleChange}
                disabled={saving}
                placeholder="Enter mobile number"
              />
            </div>

            <div className="seller-form-group">
              <label className="seller-form-label">Supplier Type</label>
              <select
                className="seller-form-select"
                name="supplier_type"
                value={form.supplier_type}
                onChange={handleChange}
                disabled={saving}
              >
                <option value="Individual">Individual</option>
                <option value="Company">Company</option>
              </select>
            </div>

            <div className="seller-form-group">
              <label className="seller-form-label">Website</label>
              <input
                className="seller-form-input"
                type="url"
                name="website"
                value={form.website}
                onChange={handleChange}
                disabled={saving}
                placeholder="https://yourwebsite.com"
              />
            </div>

            {saveError && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#dc2626',
                fontSize: 13,
                marginBottom: 16,
              }}>
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#16a34a',
                fontSize: 13,
                marginBottom: 16,
              }}>
                Profile updated successfully.
              </div>
            )}

            <button
              type="submit"
              className="seller-btn-primary"
              disabled={saving}
              style={{ minWidth: 120 }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}
    </SellerLayout>
  );
}
