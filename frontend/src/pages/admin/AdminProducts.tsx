import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface Item {
  name: string;
  item_name: string;
  item_group: string;
  standard_rate: number;
  actual_qty: number;
  website_image?: string;
  description?: string;
  disabled?: number;
  supplier?: string;
}

interface FormData {
  item_name: string;
  item_group: string;
  standard_rate: string;
  description: string;
  website_image: string;
  published: boolean;
}

const ITEM_GROUPS = ['Electronics', 'Fashion', 'Furniture', 'Books', 'Sports', 'Accessories', 'Others'];

const BLANK_FORM: FormData = {
  item_name: '',
  item_group: 'Electronics',
  standard_rate: '',
  description: '',
  website_image: '',
  published: true,
};

function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'X-Frappe-CSRF-Token': 'fetch',
      'Content-Type': 'application/json',
    },
    ...options,
  });
}

export default function AdminProducts() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<FormData>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        '/api/resource/Item?fields=["name","item_name","item_group","standard_rate","actual_qty","website_image","description","disabled","supplier"]&limit=200&order_by=creation desc'
      );
      const data = await res.json();
      setItems(data.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const filtered = items.filter(i =>
    (i.item_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditItem(null);
    setForm(BLANK_FORM);
    setError('');
    setShowModal(true);
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    setForm({
      item_name: item.item_name || '',
      item_group: item.item_group || 'Electronics',
      standard_rate: String(item.standard_rate ?? ''),
      description: item.description || '',
      website_image: item.website_image || '',
      published: !item.disabled,
    });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditItem(null);
  };

  const handleSave = async () => {
    if (!form.item_name.trim()) { setError('Item Name is required.'); return; }
    if (!form.standard_rate || isNaN(Number(form.standard_rate))) { setError('Valid price is required.'); return; }
    setSaving(true);
    setError('');
    const payload = {
      item_name: form.item_name.trim(),
      item_group: form.item_group,
      standard_rate: parseFloat(form.standard_rate),
      description: form.description,
      website_image: form.website_image,
      disabled: form.published ? 0 : 1,
    };
    try {
      if (editItem) {
        await apiFetch(`/api/resource/Item/${encodeURIComponent(editItem.name)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/resource/Item', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      closeModal();
      fetchItems();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Item) => {
    if (!window.confirm(`Delete "${item.item_name}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/resource/Item/${encodeURIComponent(item.name)}`, { method: 'DELETE' });
      fetchItems();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  const updateField = (key: keyof FormData, value: string | boolean) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const skeletonRows = Array.from({ length: 6 });

  return (
    <AdminLayout title="Products" subtitle="Manage all products">
      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title">All Products</h2>
            <p className="admin-section-subtitle">{loading ? '...' : `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="admin-search-bar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="admin-btn-primary" onClick={openAdd}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Product
            </button>
          </div>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Supplier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                skeletonRows.map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j}>
                        <div className="admin-skeleton" style={{ height: 16, borderRadius: 4 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-empty">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      </svg>
                      <h3>No products found</h3>
                      <p>{search ? 'Try a different search term.' : 'Add your first product to get started.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const isActive = (item.actual_qty ?? 0) > 0;
                  return (
                    <tr key={item.name}>
                      <td>
                        {item.website_image ? (
                          <img
                            src={item.website_image.startsWith('http') ? item.website_image : `${BASE}${item.website_image}`}
                            alt={item.item_name}
                            style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', display: 'block' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: 6, background: '#e2e8f0' }} />
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.item_name}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{item.name}</div>
                      </td>
                      <td>{item.item_group || '—'}</td>
                      <td style={{ fontWeight: 600 }}>₹{(item.standard_rate ?? 0).toLocaleString('en-IN')}</td>
                      <td>{item.actual_qty ?? 0}</td>
                      <td>
                        <span className={`admin-badge ${isActive ? 'active' : 'inactive'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{item.supplier || '—'}</td>
                      <td>
                        <div className="admin-action-btns">
                          <button className="admin-btn-edit" onClick={() => openEdit(item)}>Edit</button>
                          <button className="admin-btn-danger" onClick={() => handleDelete(item)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="admin-modal">
            <h2 className="admin-modal-title">{editItem ? 'Edit Product' : 'Add Product'}</h2>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div className="admin-form-group">
              <label className="admin-form-label">Item Name *</label>
              <input
                className="admin-form-input"
                type="text"
                placeholder="e.g. Wireless Headphones"
                value={form.item_name}
                onChange={e => updateField('item_name', e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Item Group</label>
              <select
                className="admin-form-select"
                value={form.item_group}
                onChange={e => updateField('item_group', e.target.value)}
              >
                {ITEM_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Price (₹) *</label>
              <input
                className="admin-form-input"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={form.standard_rate}
                onChange={e => updateField('standard_rate', e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Description</label>
              <textarea
                className="admin-form-textarea"
                placeholder="Product description..."
                value={form.description}
                onChange={e => updateField('description', e.target.value)}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Image URL</label>
              <input
                className="admin-form-input"
                type="text"
                placeholder="https://..."
                value={form.website_image}
                onChange={e => updateField('website_image', e.target.value)}
              />
            </div>

            <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                id="published-check"
                type="checkbox"
                checked={form.published}
                onChange={e => updateField('published', e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="published-check" className="admin-form-label" style={{ margin: 0, cursor: 'pointer' }}>
                Published (visible on website)
              </label>
            </div>

            <div className="admin-modal-actions">
              <button className="admin-btn-secondary" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
