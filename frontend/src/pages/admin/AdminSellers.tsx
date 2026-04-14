import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface Supplier {
  name: string;
  supplier_name: string;
  supplier_type: string;
  website?: string;
  country?: string;
  creation: string;
}

interface SellerForm {
  supplier_name: string;
  supplier_type: string;
  website: string;
  country: string;
}

const EMPTY_FORM: SellerForm = {
  supplier_name: '',
  supplier_type: 'Company',
  website: '',
  country: '',
};

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '') },
    ...options,
  });
  return r.json();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr.slice(0, 10);
  }
}

export default function AdminSellers() {
  const [sellers, setSellers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SellerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchSellers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ data: Supplier[] }>(
        '/api/resource/Supplier?fields=["name","supplier_name","supplier_type","website","country","creation"]&limit=200&order_by=creation desc'
      );
      setSellers(res.data ?? []);
    } catch {
      setSellers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSellers(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return sellers;
    return sellers.filter(s =>
      s.supplier_name?.toLowerCase().includes(q) ||
      s.supplier_type?.toLowerCase().includes(q) ||
      s.website?.toLowerCase().includes(q) ||
      s.country?.toLowerCase().includes(q)
    );
  }, [sellers, search]);

  const totalSellers = sellers.length;
  const activeSellers = sellers.filter(s => s.supplier_type === 'Company').length;
  const individualSellers = sellers.filter(s => s.supplier_type !== 'Company').length;

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditTarget(s);
    setForm({
      supplier_name: s.supplier_name,
      supplier_type: s.supplier_type,
      website: s.website ?? '',
      country: s.country ?? '',
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const handleSave = async () => {
    if (!form.supplier_name.trim()) {
      setError('Supplier Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editTarget) {
        await apiRequest(`/api/resource/Supplier/${encodeURIComponent(editTarget.name)}`, {
          method: 'PUT',
          body: JSON.stringify({
            supplier_name: form.supplier_name,
            supplier_type: form.supplier_type,
            website: form.website,
            country: form.country,
          }),
        });
      } else {
        await apiRequest('/api/resource/Supplier', {
          method: 'POST',
          body: JSON.stringify({
            supplier_name: form.supplier_name,
            supplier_type: form.supplier_type,
            website: form.website,
            country: form.country,
          }),
        });
      }
      setModalOpen(false);
      fetchSellers();
    } catch (e) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Sellers" subtitle="Manage all sellers">
      {/* Summary cards */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : totalSellers}</div>
          <div className="admin-stat-label">Total Sellers</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : activeSellers}</div>
          <div className="admin-stat-label">Active Suppliers (Company)</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : individualSellers}</div>
          <div className="admin-stat-label">Individual Sellers</div>
        </div>
      </div>

      {/* Table section */}
      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title">All Sellers</h2>
            <p className="admin-section-subtitle">{filtered.length} seller{filtered.length !== 1 ? 's' : ''} found</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="admin-search-bar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search sellers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="admin-btn-primary" onClick={openAdd}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Seller
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="admin-skeleton" style={{ height: 44, borderRadius: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            <h3>No sellers found</h3>
            <p>{search ? 'Try a different search term.' : 'Add your first seller to get started.'}</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Website</th>
                  <th>Created</th>
                  <th>Products</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.name}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{s.supplier_name}</div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{s.name}</div>
                    </td>
                    <td>
                      <span className={`admin-badge ${s.supplier_type === 'Company' ? 'active' : 'draft'}`}>
                        {s.supplier_type || '—'}
                      </span>
                    </td>
                    <td>
                      {s.website ? (
                        <a href={s.website.startsWith('http') ? s.website : `https://${s.website}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: '#3b82f6', textDecoration: 'none', fontSize: 13 }}>
                          {s.website}
                        </a>
                      ) : '—'}
                    </td>
                    <td style={{ color: '#64748b', fontSize: 13 }}>{formatDate(s.creation)}</td>
                    <td style={{ color: '#94a3b8' }}>—</td>
                    <td>
                      <div className="admin-action-btns">
                        <button className="admin-btn-edit" onClick={() => openEdit(s)}>Edit</button>
                        <a
                          href={`${import.meta.env.VITE_API_BASE_URL ?? ''}/app/supplier/${encodeURIComponent(s.name)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', borderRadius: 6 }}
                        >
                          Frappe
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h2 className="admin-modal-title">{editTarget ? 'Edit Seller' : 'Add Seller'}</h2>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16
              }}>
                {error}
              </div>
            )}

            <div className="admin-form-group">
              <label className="admin-form-label">Supplier Name *</label>
              <input
                className="admin-form-input"
                type="text"
                placeholder="e.g. Acme Corp"
                value={form.supplier_name}
                onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Supplier Type</label>
              <select
                className="admin-form-select"
                value={form.supplier_type}
                onChange={e => setForm(f => ({ ...f, supplier_type: e.target.value }))}
              >
                <option value="Company">Company</option>
                <option value="Individual">Individual</option>
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Website</label>
              <input
                className="admin-form-input"
                type="text"
                placeholder="e.g. https://example.com"
                value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Country</label>
              <input
                className="admin-form-input"
                type="text"
                placeholder="e.g. India"
                value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
              />
            </div>

            <div className="admin-modal-actions">
              <button className="admin-btn-secondary" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editTarget ? 'Update Seller' : 'Add Seller'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
