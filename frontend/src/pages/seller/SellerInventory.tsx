import { useState, useEffect } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface InventoryItem {
  name: string;
  item_name: string;
  item_group: string;
  actual_qty: number;
  reserved_qty: number;
  projected_qty: number;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': 'fetch' },
    ...options,
  });
  return res.json() as Promise<T>;
}

function stockStatus(qty: number): { label: string; cls: string } {
  if (qty <= 0)  return { label: 'Out of Stock', cls: 'out-stock' };
  if (qty < 10)  return { label: 'Low Stock',    cls: 'low-stock' };
  return           { label: 'In Stock',           cls: 'in-stock' };
}

export default function SellerInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editStock, setEditStock] = useState<Record<string, string>>({});
  const [savingItem, setSavingItem] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: InventoryItem[] }>(
        '/api/resource/Item?limit=100&fields=["name","item_name","item_group","actual_qty","reserved_qty","projected_qty"]&order_by=actual_qty asc'
      );
      setItems(res.data || []);
    } catch {
      // backend offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadItems(); }, []);

  const handleStockUpdate = async (itemName: string) => {
    const newQty = editStock[itemName];
    if (newQty === undefined || newQty === '') return;
    setSavingItem(itemName);
    try {
      await apiFetch(`/api/resource/Item/${encodeURIComponent(itemName)}`, {
        method: 'PUT',
        body: JSON.stringify({ actual_qty: parseFloat(newQty) }),
      });
      await loadItems();
      setEditStock(prev => {
        const next = { ...prev };
        delete next[itemName];
        return next;
      });
    } catch {
      // handle
    } finally {
      setSavingItem(null);
    }
  };

  const totalSKUs    = items.length;
  const lowStockCnt  = items.filter(i => (i.actual_qty || 0) > 0 && (i.actual_qty || 0) < 10).length;
  const outStockCnt  = items.filter(i => (i.actual_qty || 0) <= 0).length;

  return (
    <SellerLayout title="Inventory" subtitle="Monitor and update stock levels">

      {/* Summary cards */}
      <div className="seller-stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon purple">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            </div>
          </div>
          <div className="stat-card-value">{loading ? '—' : totalSKUs}</div>
          <div className="stat-card-label">Total SKUs</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon orange">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <span className="stat-card-trend warn">Alert</span>
          </div>
          <div className="stat-card-value">{loading ? '—' : lowStockCnt}</div>
          <div className="stat-card-label">Low Stock Items</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            {outStockCnt > 0 && <span className="stat-card-trend down">Critical</span>}
          </div>
          <div className="stat-card-value">{loading ? '—' : outStockCnt}</div>
          <div className="stat-card-label">Out of Stock</div>
        </div>
      </div>

      {lowStockCnt > 0 && (
        <div className="seller-note warn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {lowStockCnt} item{lowStockCnt > 1 ? 's are' : ' is'} running low on stock. Restock soon to avoid stockouts.
        </div>
      )}

      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">Stock Levels</h2>
            <p className="seller-section-subtitle">Sorted by lowest stock first</p>
          </div>
        </div>
        <div className="seller-table-wrapper">
          <table className="seller-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Reserved</th>
                <th>Available</th>
                <th>Status</th>
                <th>Update Stock</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4,5,6,7].map(j => (
                      <td key={j}><div className="seller-skeleton seller-skeleton-row" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="seller-empty">
                      <h3>No inventory data</h3>
                      <p>Add products to see inventory here</p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const actual = item.actual_qty || 0;
                  const reserved = item.reserved_qty || 0;
                  const available = actual - reserved;
                  const { label, cls } = stockStatus(actual);
                  const isEditing = editStock[item.name] !== undefined;

                  return (
                    <tr key={item.name}>
                      <td style={{ fontWeight: 600, color: '#1a1a2e' }}>{item.item_name}</td>
                      <td style={{ color: '#6b7280' }}>{item.item_group}</td>
                      <td style={{ fontWeight: 700 }}>{actual}</td>
                      <td style={{ color: '#6b7280' }}>{reserved}</td>
                      <td style={{ fontWeight: 600, color: available < 5 ? '#ef4444' : '#059669' }}>{available}</td>
                      <td><span className={`seller-badge ${cls}`}>{label}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            className="seller-stock-input"
                            type="number"
                            min="0"
                            placeholder={String(actual)}
                            value={isEditing ? editStock[item.name] : ''}
                            onChange={e => setEditStock(prev => ({ ...prev, [item.name]: e.target.value }))}
                          />
                          {isEditing && (
                            <button
                              className="seller-btn seller-btn-sm"
                              disabled={savingItem === item.name}
                              onClick={() => handleStockUpdate(item.name)}
                            >
                              {savingItem === item.name ? '...' : 'Save'}
                            </button>
                          )}
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
    </SellerLayout>
  );
}
