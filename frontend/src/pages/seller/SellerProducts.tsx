import { useState, useEffect, type FormEvent } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface Product {
  name: string;
  item_name: string;
  item_group: string;
  standard_rate: number;
  selling_price?: number;
  website_image?: string;
  description?: string;
  is_sales_item?: number;
  published?: number;
  actual_qty?: number;
}

interface FormState {
  item_name: string;
  item_group: string;
  standard_rate: string;
  description: string;
  website_image: string;
  is_sales_item: boolean;
}

const EMPTY_FORM: FormState = {
  item_name: '',
  item_group: '',
  standard_rate: '',
  description: '',
  website_image: '',
  is_sales_item: true,
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '') },
    ...options,
  });
  const data = await res.json() as T;
  return data;
}

export default function SellerProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Product[] }>(
        '/api/resource/Item?limit=50&fields=["name","item_name","item_group","website_image","description","is_sales_item"]'
      );
      setProducts(res.data || []);
    } catch {
      // backend offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingName(null);
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setForm({
      item_name: product.item_name || '',
      item_group: product.item_group || '',
      standard_rate: String(product.selling_price ?? product.standard_rate ?? ''),
      description: product.description || '',
      website_image: product.website_image || '',
      is_sales_item: !!product.is_sales_item,
    });
    setEditingName(product.name);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingName(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        item_name: form.item_name,
        item_group: form.item_group || 'Products',
        standard_rate: parseFloat(form.standard_rate) || 0,
        description: form.description,
        website_image: form.website_image,
        is_sales_item: form.is_sales_item ? 1 : 0,
      };
      if (editingName) {
        await apiFetch(`/api/resource/Item/${encodeURIComponent(editingName)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/resource/Item', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      await loadProducts();
      closeModal();
    } catch {
      // handle error silently
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await apiFetch(`/api/resource/Item/${encodeURIComponent(name)}`, { method: 'DELETE' });
      await loadProducts();
    } catch {
      // handle error
    } finally {
      setDeleteConfirm(null);
    }
  };

  const filtered = products.filter(p =>
    p.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.item_group?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SellerLayout title="Products" subtitle="Manage your product catalog">

      {/* Search + Add */}
      <div className="seller-search-bar">
        <div className="seller-search-wrapper" style={{ flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="seller-search-input"
            placeholder="Search products by name or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 36 }}
          />
        </div>
        <button className="seller-btn" onClick={openAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add Product
        </button>
      </div>

      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">All Products</h2>
            <p className="seller-section-subtitle">{filtered.length} items found</p>
          </div>
        </div>
        <div className="seller-table-wrapper">
          <table className="seller-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => (
                      <td key={j}><div className="seller-skeleton seller-skeleton-row" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="seller-empty">
                      <div className="seller-empty-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                      </div>
                      <h3>No products found</h3>
                      <p>Add your first product to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(product => (
                  <tr key={product.name}>
                    <td>
                      {product.website_image ? (
                        <img src={product.website_image} alt={product.item_name} className="product-thumb" />
                      ) : (
                        <div className="product-thumb-placeholder">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: 600, color: '#1a1a2e' }}>{product.item_name}</td>
                    <td style={{ color: '#6b7280' }}>{product.item_group}</td>
                    <td style={{ fontWeight: 700 }}>₹{(product.selling_price ?? product.standard_rate ?? 0).toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`seller-badge ${product.is_sales_item ? 'published' : 'draft'}`}>
                        {product.is_sales_item ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      <div className="seller-action-btns">
                        <button className="seller-btn-outline sm" onClick={() => openEdit(product)}>
                          Edit
                        </button>
                        <button
                          className="seller-btn-danger"
                          onClick={() => setDeleteConfirm(product.name)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="seller-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="seller-modal">
            <div className="seller-modal-header">
              <h3 className="seller-modal-title">{editingName ? 'Edit Product' : 'Add New Product'}</h3>
              <button className="seller-modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="seller-modal-body">
              <form className="seller-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Item Name *</label>
                  <input
                    required
                    value={form.item_name}
                    onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
                    placeholder="e.g. iPhone 15 Pro"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Item Group</label>
                    <select
                      value={form.item_group}
                      onChange={e => setForm(f => ({ ...f, item_group: e.target.value }))}
                    >
                      <option value="">Select group...</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Fashion">Fashion</option>
                      <option value="Furniture">Furniture</option>
                      <option value="Books">Books</option>
                      <option value="Sports">Sports</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Products">Products</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Price (₹) *</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.standard_rate}
                      onChange={e => setForm(f => ({ ...f, standard_rate: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Product description..."
                  />
                </div>
                <div className="form-group">
                  <label>Image URL</label>
                  <input
                    type="url"
                    value={form.website_image}
                    onChange={e => setForm(f => ({ ...f, website_image: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="form-group">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      id="is_sales_item"
                      checked={form.is_sales_item}
                      onChange={e => setForm(f => ({ ...f, is_sales_item: e.target.checked }))}
                    />
                    <label htmlFor="is_sales_item" style={{ margin: 0, fontWeight: 500 }}>Published (visible in store)</label>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="seller-btn-outline" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="seller-btn" disabled={saving}>
                    {saving ? 'Saving...' : editingName ? 'Update Product' : 'Add Product'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="seller-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div className="seller-modal" style={{ maxWidth: 400 }}>
            <div className="seller-modal-header">
              <h3 className="seller-modal-title">Confirm Delete</h3>
              <button className="seller-modal-close" onClick={() => setDeleteConfirm(null)}>×</button>
            </div>
            <div className="seller-modal-body">
              <p style={{ color: '#3d4a5c', marginTop: 0 }}>
                Are you sure you want to delete <strong>{deleteConfirm}</strong>? This action cannot be undone.
              </p>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button className="seller-btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button
                  style={{ padding: '9px 18px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => handleDelete(deleteConfirm)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  );
}
