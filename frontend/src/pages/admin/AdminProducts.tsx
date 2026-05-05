import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { api, post, del, BASE_URL as BASE } from '../../services/client';

interface Item {
  name: string;
  item_name: string;
  item_group: string;
  standard_rate: number;
  selling_price?: number;
  image?: string;
  description?: string;
  disabled?: number;
  supplier?: string;
  actual_qty?: number;
}

interface FormData {
  item_name: string;
  item_group: string;
  standard_rate: string;
  description: string;
  website_image: string;
  published: boolean;
  stock_qty: string;
}

interface ItemGroup { name: string; parent_item_group: string; is_group: number; }

const BLANK_FORM: FormData = {
  item_name: '',
  item_group: '',
  standard_rate: '',
  description: '',
  website_image: '',
  published: true,
  stock_qty: '0',
};


export default function AdminProducts() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [form, setForm] = useState<FormData>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stockEditItem, setStockEditItem] = useState<string | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockSaving, setStockSaving] = useState(false);

  // Item groups — fetched from Frappe
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupParent, setNewGroupParent] = useState('All Item Groups');
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ message: Item[] }>('/api/method/store_customizations.api.get_admin_products');
      setItems(data.message || []);
    } catch (err: unknown) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Failed to fetch products.');
    } finally {
      setLoading(false);
    }
  };

  const fetchItemGroups = async () => {
    try {
      const data = await api<{ message: ItemGroup[] }>('/api/method/store_customizations.api.get_item_groups');
      const groups = data.message || [];
      setItemGroups(groups);
      // Set default form group to first available
      if (groups.length > 0 && !form.item_group) {
        setForm(f => ({ ...f, item_group: groups[0].name }));
      }
    } catch {}
  };

  useEffect(() => { fetchItems(); fetchItemGroups(); }, []);

  const filtered = items.filter(i =>
    (i.item_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const addItemGroup = async () => {
    if (!newGroupName.trim()) { setGroupError('Group name is required.'); return; }
    setAddingGroup(true); setGroupError('');
    try {
      await post('/api/method/store_customizations.api.create_item_group', {
        group_name: newGroupName.trim(),
        parent_item_group: newGroupParent || 'All Item Groups',
      });
      await fetchItemGroups();
      setForm(f => ({ ...f, item_group: newGroupName.trim() }));
      setShowAddGroup(false);
      setNewGroupName('');
      setNewGroupParent('All Item Groups');
    } catch (e) {
      setGroupError(e instanceof Error ? e.message : 'Failed to create group.');
    } finally {
      setAddingGroup(false);
    }
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...BLANK_FORM, item_group: itemGroups[0]?.name || '' });
    setError('');
    setShowAddGroup(false);
    setShowModal(true);
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    setForm({
      item_name: item.item_name || '',
      item_group: item.item_group || itemGroups[0]?.name || '',
      standard_rate: String(item.selling_price ?? item.standard_rate ?? ''),
      description: item.description || '',
      website_image: item.image || '',
      published: !item.disabled,
      stock_qty: String(item.actual_qty ?? 0),
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
    if (Number(form.standard_rate) <= 0) { setError('Price must be greater than 0.'); return; }
    const newStock = parseFloat(form.stock_qty);
    if (isNaN(newStock) || newStock < 0) { setError('Stock quantity must be 0 or more.'); return; }
    setSaving(true);
    setError('');
    try {
      await post('/api/method/store_customizations.api.save_admin_product', {
        item_name:   form.item_name.trim(),
        item_group:  form.item_group,
        price:       parseFloat(form.standard_rate),
        stock_qty:   newStock,
        description: form.description,
        image:       form.website_image,
        published:   form.published ? 1 : 0,
        item_code:   editItem ? editItem.name : null,
      });
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
      await del(`/api/resource/Item/${encodeURIComponent(item.name)}`);
      fetchItems();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  const updateField = (key: keyof FormData, value: string | boolean) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const startStockEdit = (item: Item) => {
    setStockEditItem(item.name);
    setStockQty(String(item.actual_qty ?? 0));
  };

  const saveStock = async (itemName: string) => {
    setStockSaving(true);
    try {
      await post('/api/method/store_customizations.api.update_item_stock', {
        item_code: itemName, qty: parseFloat(stockQty) || 0,
      });
      setStockEditItem(null);
      fetchItems();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Stock update failed.');
    } finally {
      setStockSaving(false);
    }
  };

  const stockBadgeClass = (qty?: number) => {
    const q = qty ?? 0;
    if (q <= 0) return 'out-stock';
    if (q < 10) return 'low-stock';
    return 'in-stock';
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
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
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
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
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
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      </svg>
                      <h3>No products found</h3>
                      <p>{search ? 'Try a different search term.' : 'Add your first product to get started.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(item => {
                  const isActive = !item.disabled;
                  return (
                    <tr key={item.name}>
                      <td>
                        {item.image ? (
                          <img
                            src={item.image.startsWith('http') ? item.image : `${BASE}${item.image}`}
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
                      <td style={{ fontWeight: 600 }}>₹{(item.selling_price ?? item.standard_rate ?? 0).toLocaleString('en-IN')}</td>
                      <td>
                        {stockEditItem === item.name ? (
                          <div className="admin-stock-edit">
                            <input
                              className="admin-stock-input"
                              type="number"
                              min="0"
                              value={stockQty}
                              onChange={e => setStockQty(e.target.value)}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveStock(item.name);
                                if (e.key === 'Escape') setStockEditItem(null);
                              }}
                            />
                            <button className="admin-stock-save" disabled={stockSaving} onClick={() => saveStock(item.name)}>✓</button>
                            <button className="admin-stock-cancel" onClick={() => setStockEditItem(null)}>✗</button>
                          </div>
                        ) : (
                          <div className="admin-stock-cell" onClick={() => startStockEdit(item)} title="Click to update stock">
                            <span className={`admin-badge ${stockBadgeClass(item.actual_qty)}`}>
                              {item.actual_qty ?? 0}
                            </span>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </div>
                        )}
                      </td>
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  className="admin-form-select"
                  style={{ flex: 1 }}
                  value={form.item_group}
                  onChange={e => updateField('item_group', e.target.value)}
                >
                  {itemGroups.length === 0 && <option value="">— loading —</option>}
                  {itemGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
                <button
                  type="button"
                  title="Add new item group"
                  style={{
                    width: 36, height: 36, flexShrink: 0,
                    borderRadius: 8, border: '1.5px solid #6366f1',
                    background: '#6366f1', color: '#fff', fontSize: 22,
                    cursor: 'pointer', fontWeight: 700, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onClick={() => { setShowAddGroup(true); setGroupError(''); setNewGroupName(''); setNewGroupParent('All Item Groups'); }}
                >+</button>
              </div>
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

            <div className="admin-form-group">
              <label className="admin-form-label">{editItem ? 'Stock Quantity' : 'Initial Stock'}</label>
              <input
                className="admin-form-input"
                type="number"
                placeholder="0"
                min="0"
                step="1"
                value={form.stock_qty}
                onChange={e => updateField('stock_qty', e.target.value)}
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

      {/* Add Item Group dialog — floats above everything */}
      {showAddGroup && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowAddGroup(false); }}
        >
          <div style={{
            background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400,
            padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>New Item Group</h3>
              <button
                type="button"
                onClick={() => setShowAddGroup(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
              >×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Group Name *
                </label>
                <input
                  className="admin-form-input"
                  placeholder="e.g. Clothing, Electronics…"
                  value={newGroupName}
                  autoFocus
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItemGroup()}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Parent Group
                </label>
                <select
                  className="admin-form-select"
                  value={newGroupParent}
                  onChange={e => setNewGroupParent(e.target.value)}
                >
                  <option value="All Item Groups">All Item Groups (root)</option>
                  {itemGroups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
              </div>

              {groupError && (
                <p style={{ margin: 0, color: '#dc2626', fontSize: 13, background: '#fef2f2', padding: '8px 12px', borderRadius: 8 }}>
                  {groupError}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  className="admin-btn-primary"
                  style={{ flex: 1, padding: '10px 0' }}
                  disabled={addingGroup}
                  onClick={addItemGroup}
                >
                  {addingGroup ? 'Saving…' : 'Add Group'}
                </button>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  style={{ padding: '10px 20px' }}
                  onClick={() => setShowAddGroup(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
