import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// ── Types ──────────────────────────────────────────────────────────────────

interface SalesOrder {
  name: string;
  grand_total: number;
  status: string;
  transaction_date: string;
  customer_name: string;
}

interface Item {
  name: string;
  item_name: string;
  standard_rate: number;
  actual_qty: number;
  item_group: string;
}

interface Supplier {
  name: string;
  supplier_name: string;
}

interface DashboardData {
  orders: SalesOrder[];
  items: Item[];
  suppliers: Supplier[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function statusClass(s: string) {
  const v = s.toLowerCase();
  if (v.includes('complet') || v.includes('deliver')) return 'delivered';
  if (v.includes('cancel')) return 'cancelled';
  if (v.includes('ship')) return 'shipped';
  return 'pending';
}

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    headers: { 'X-Frappe-CSRF-Token': 'fetch' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json() as Promise<T>;
}

// ── Skeleton card ──────────────────────────────────────────────────────────

function SkeletonStatCard() {
  return (
    <div className="admin-stat-card">
      <div className="admin-skeleton" style={{ height: 40, width: 40, borderRadius: 10, marginBottom: 14 }} />
      <div className="admin-skeleton" style={{ height: 28, width: '60%', borderRadius: 6, marginBottom: 8 }} />
      <div className="admin-skeleton" style={{ height: 14, width: '80%', borderRadius: 4 }} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [ordersRes, itemsRes, suppliersRes] = await Promise.all([
          fetchJson<{ data: SalesOrder[] }>(
            '/api/resource/Sales%20Order?fields=["grand_total","status","transaction_date","customer_name","name"]&filters=[["docstatus","=","1"]]&limit=500'
          ),
          fetchJson<{ data: Item[] }>(
            '/api/resource/Item?fields=["name","item_name","standard_rate","actual_qty","item_group"]&limit=500'
          ),
          fetchJson<{ data: Supplier[] }>(
            '/api/resource/Supplier?fields=["name","supplier_name"]&limit=100'
          ),
        ]);

        if (!cancelled) {
          setData({
            orders: ordersRes.data ?? [],
            items: itemsRes.data ?? [],
            suppliers: suppliersRes.data ?? [],
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load dashboard data.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Derived stats ────────────────────────────────────────────────────────

  const totalRevenue = data
    ? data.orders.reduce((sum, o) => sum + (o.grand_total ?? 0), 0)
    : 0;
  const totalOrders = data?.orders.length ?? 0;
  const totalProducts = data?.items.length ?? 0;
  const totalSellers = data?.suppliers.length ?? 0;
  const lowStockItems = data
    ? data.items.filter((i) => (i.actual_qty ?? 0) < 10).length
    : 0;

  const recentOrders = data
    ? [...data.orders]
        .sort(
          (a, b) =>
            new Date(b.transaction_date).getTime() -
            new Date(a.transaction_date).getTime()
        )
        .slice(0, 10)
    : [];

  const topProducts = data
    ? [...data.items]
        .sort((a, b) => (b.standard_rate ?? 0) - (a.standard_rate ?? 0))
        .slice(0, 5)
    : [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Overview of your store performance"
    >
      {/* Error banner */}
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8,
            padding: '10px 16px',
            color: '#dc2626',
            fontSize: 13,
            marginBottom: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="admin-stats-grid">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonStatCard key={i} />)
        ) : (
          <>
            {/* Total Revenue */}
            <div className="admin-stat-card">
              <div className="admin-stat-icon blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <div className="admin-stat-value">{inr(totalRevenue)}</div>
              <div className="admin-stat-label">Total Revenue</div>
            </div>

            {/* Total Orders */}
            <div className="admin-stat-card">
              <div className="admin-stat-icon green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <div className="admin-stat-value">{totalOrders.toLocaleString()}</div>
              <div className="admin-stat-label">Total Orders</div>
            </div>

            {/* Total Products */}
            <div className="admin-stat-card">
              <div className="admin-stat-icon orange">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
              <div className="admin-stat-value">{totalProducts.toLocaleString()}</div>
              <div className="admin-stat-label">Total Products</div>
            </div>

            {/* Total Sellers */}
            <div className="admin-stat-card">
              <div className="admin-stat-icon purple">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="admin-stat-value">{totalSellers.toLocaleString()}</div>
              <div className="admin-stat-label">Total Sellers</div>
            </div>

            {/* Low Stock Items */}
            <div className="admin-stat-card">
              <div className="admin-stat-icon red">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="admin-stat-value">{lowStockItems.toLocaleString()}</div>
              <div className="admin-stat-label">Low Stock Items</div>
              {lowStockItems > 0 && (
                <div className="admin-stat-trend" style={{ color: '#ef4444' }}>
                  Needs attention
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Two-column row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 22, alignItems: 'start' }}>
        {/* Recent Orders */}
        <div className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-title">Recent Orders</p>
              <p className="admin-section-subtitle">Last 10 confirmed orders</p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="admin-skeleton" style={{ height: 44, borderRadius: 6 }} />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="admin-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <h3>No orders yet</h3>
              <p>Confirmed sales orders will appear here.</p>
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.name}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>
                          {order.name}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {order.customer_name || '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>
                        {inr(order.grand_total ?? 0)}
                      </td>
                      <td>
                        <span className={`admin-badge ${statusClass(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: 12.5 }}>
                        {formatDate(order.transaction_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-title">Top Products</p>
              <p className="admin-section-subtitle">By listed price</p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="admin-skeleton" style={{ height: 52, borderRadius: 8 }} />
              ))}
            </div>
          ) : topProducts.length === 0 ? (
            <div className="admin-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
              <h3>No products</h3>
              <p>Items will appear here once added.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topProducts.map((product, idx) => (
                <div
                  key={product.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid #e8edf3',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {product.item_name || product.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                      {product.item_group || 'Uncategorized'}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#3b82f6',
                      flexShrink: 0,
                    }}
                  >
                    {inr(product.standard_rate ?? 0)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Responsive two-column fallback */}
      <style>{`
        @media (max-width: 900px) {
          .admin-dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </AdminLayout>
  );
}
