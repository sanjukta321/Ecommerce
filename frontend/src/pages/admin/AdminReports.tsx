import { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface SalesOrder {
  name: string;
  grand_total: number;
  transaction_date: string;
  customer_name: string;
  status: string;
}

interface Item {
  name: string;
  item_name: string;
  item_group: string;
  standard_rate: number;
  actual_qty: number;
  supplier?: string;
}

interface Supplier {
  name: string;
  supplier_name: string;
  supplier_type: string;
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': 'fetch' },
    ...options,
  });
  return r.json();
}

function getMonthKey(dateStr: string): string {
  return dateStr ? dateStr.slice(0, 7) : '';
}

function getLast6Months(): { key: string; label: string }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    };
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

export default function AdminReports() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [ordersRes, itemsRes, suppliersRes] = await Promise.all([
          apiRequest<{ data: SalesOrder[] }>(
            '/api/resource/Sales%20Order?fields=["name","grand_total","transaction_date","customer_name","status"]&filters=[["docstatus","=","1"]]&limit=500'
          ),
          apiRequest<{ data: Item[] }>(
            '/api/resource/Item?fields=["name","item_name","item_group","standard_rate","actual_qty","supplier"]&limit=300'
          ),
          apiRequest<{ data: Supplier[] }>(
            '/api/resource/Supplier?fields=["name","supplier_name","supplier_type"]&limit=100'
          ),
        ]);
        setOrders(ordersRes.data ?? []);
        setItems(itemsRes.data ?? []);
        setSuppliers(suppliersRes.data ?? []);
      } catch {
        setOrders([]);
        setItems([]);
        setSuppliers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const last6Months = useMemo(() => getLast6Months(), []);

  // Monthly revenue for last 6 months
  const monthlyRevenue = useMemo(() => {
    const revenueMap: Record<string, number> = {};
    for (const m of last6Months) revenueMap[m.key] = 0;
    for (const o of orders) {
      const key = getMonthKey(o.transaction_date);
      if (key in revenueMap) {
        revenueMap[key] += o.grand_total ?? 0;
      }
    }
    return last6Months.map(m => ({ ...m, revenue: revenueMap[m.key] ?? 0 }));
  }, [orders, last6Months]);

  // Summary stats
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const revenueThisMonth = useMemo(() =>
    orders.filter(o => getMonthKey(o.transaction_date) === currentMonthKey)
      .reduce((sum, o) => sum + (o.grand_total ?? 0), 0),
    [orders, currentMonthKey]
  );

  const ordersThisMonth = useMemo(() =>
    orders.filter(o => getMonthKey(o.transaction_date) === currentMonthKey).length,
    [orders, currentMonthKey]
  );

  const avgOrderValue = useMemo(() =>
    orders.length > 0 ? orders.reduce((sum, o) => sum + (o.grand_total ?? 0), 0) / orders.length : 0,
    [orders]
  );

  // Top seller by item count
  const topSeller = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (item.supplier) {
        counts[item.supplier] = (counts[item.supplier] ?? 0) + 1;
      }
    }
    let topName = '—';
    let topCount = 0;
    for (const [suppName, count] of Object.entries(counts)) {
      if (count > topCount) {
        topCount = count;
        topName = suppName;
      }
    }
    // Look up display name
    const supplierRecord = suppliers.find(s => s.name === topName);
    return supplierRecord ? supplierRecord.supplier_name : topName;
  }, [items, suppliers]);

  // Top 10 products by standard_rate
  const topProducts = useMemo(() =>
    [...items]
      .sort((a, b) => (b.standard_rate ?? 0) - (a.standard_rate ?? 0))
      .slice(0, 10),
    [items]
  );

  // Top sellers by item count
  const topSellersByItems = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (item.supplier) {
        counts[item.supplier] = (counts[item.supplier] ?? 0) + 1;
      }
    }
    return suppliers
      .map(s => ({ ...s, productCount: counts[s.name] ?? 0 }))
      .sort((a, b) => b.productCount - a.productCount)
      .slice(0, 10);
  }, [items, suppliers]);

  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue), 1);

  return (
    <AdminLayout title="Reports" subtitle="Revenue analytics and performance">
      {/* Summary cards */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : formatCurrency(revenueThisMonth)}</div>
          <div className="admin-stat-label">Revenue This Month</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : ordersThisMonth}</div>
          <div className="admin-stat-label">Orders This Month</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : formatCurrency(avgOrderValue)}</div>
          <div className="admin-stat-label">Avg Order Value</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="admin-stat-value" style={{ fontSize: 18 }}>{loading ? '—' : topSeller}</div>
          <div className="admin-stat-label">Top Seller</div>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title">Monthly Revenue</h2>
            <p className="admin-section-subtitle">Last 6 months overview</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="admin-skeleton" style={{ height: 28, borderRadius: 6 }} />
            ))}
          </div>
        ) : (
          <div className="admin-chart-container">
            {monthlyRevenue.map(m => (
              <div className="admin-chart-row" key={m.key}>
                <div className="admin-chart-label">{m.label}</div>
                <div className="admin-chart-track">
                  <div
                    className="admin-chart-bar"
                    style={{ width: `${(m.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
                <div className="admin-chart-value">{formatCurrency(m.revenue)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Selling Products */}
      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title">Top Selling Products</h2>
            <p className="admin-section-subtitle">Top 10 by standard rate</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="admin-skeleton" style={{ height: 44, borderRadius: 8 }} />
            ))}
          </div>
        ) : topProducts.length === 0 ? (
          <div className="admin-empty">
            <h3>No products found</h3>
            <p>Product data will appear here once items are added in Frappe.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((item, idx) => (
                  <tr key={item.name}>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: '50%',
                        background: idx < 3 ? 'rgba(59,130,246,0.12)' : '#f1f5f9',
                        color: idx < 3 ? '#2563eb' : '#64748b',
                        fontSize: 12, fontWeight: 700,
                      }}>
                        {idx + 1}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.item_name}</div>
                      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{item.name}</div>
                    </td>
                    <td>
                      <span className="admin-badge draft">{item.item_group || '—'}</span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#059669' }}>
                      {formatCurrency(item.standard_rate ?? 0)}
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 600,
                        color: (item.actual_qty ?? 0) > 0 ? '#0f172a' : '#ef4444',
                      }}>
                        {item.actual_qty ?? 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Sellers */}
      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title">Top Sellers</h2>
            <p className="admin-section-subtitle">Suppliers ranked by products listed</p>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="admin-skeleton" style={{ height: 44, borderRadius: 8 }} />
            ))}
          </div>
        ) : topSellersByItems.length === 0 ? (
          <div className="admin-empty">
            <h3>No seller data</h3>
            <p>Seller rankings will appear once suppliers are linked to products.</p>
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller Name</th>
                  <th>Type</th>
                  <th>Products Listed</th>
                </tr>
              </thead>
              <tbody>
                {topSellersByItems.map((seller, idx) => (
                  <tr key={seller.name}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26, borderRadius: '50%',
                          background: idx < 3 ? 'rgba(16,185,129,0.12)' : '#f1f5f9',
                          color: idx < 3 ? '#059669' : '#64748b',
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                        }}>
                          {idx + 1}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{seller.supplier_name}</div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{seller.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`admin-badge ${seller.supplier_type === 'Company' ? 'active' : 'draft'}`}>
                        {seller.supplier_type || '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#3b82f6', fontSize: 15 }}>
                        {seller.productCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
