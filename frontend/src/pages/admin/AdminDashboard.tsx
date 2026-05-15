import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  selling_price?: number;
  item_group: string;
}



interface DashboardData {
  total_orders: number;
  total_products: number;
  total_sellers: number;
  total_customers: number;
  total_revenue: number;
  recent_orders: SalesOrder[];
  top_products: Item[];
}

interface DiagnosticInfo {
  user: string;
  roles: string[];
  has_item_read_permission: boolean;
  total_items: number;
  disabled_items: number;
  website_items: number;
  is_system_manager: boolean;
  site: string;
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
    headers: { 'X-Frappe-CSRF-Token': (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '') },
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
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [diag, setDiag] = useState<DiagnosticInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [summaryRes, diagRes, ordersRes, itemsRes] = await Promise.all([
          fetchJson<{ message: DashboardData }>(
            '/api/method/store_customizations.api.orders.get_admin_summary'
          ),
          fetchJson<{ message: DiagnosticInfo }>(
            '/api/method/store_customizations.api.products.check_products_setup'
          ),
          fetchJson<{ data: SalesOrder[] }>(
            '/api/resource/Sales%20Order?fields=["grand_total","status","transaction_date","customer_name","name"]&limit=10&order_by=creation desc'
          ),
          fetchJson<{ data: Item[] }>(
            '/api/resource/Item?fields=["name","item_name","item_group","standard_rate"]&limit=5&order_by=standard_rate%20desc'
          ),
        ]);

        if (!cancelled) {
          setData({
            ...summaryRes.message,
            recent_orders: ordersRes.data ?? [],
            top_products: itemsRes.data ?? [],
          });
          setDiag(diagRes.message);
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

  const totalRevenue = data?.total_revenue ?? 0;
  const totalOrders = data?.total_orders ?? 0;
  const totalProducts = data?.total_products ?? 0;
  const totalSellers = data?.total_sellers ?? 0;
  const totalCustomers = data?.total_customers ?? 0;

  const recentOrders = data?.recent_orders ?? [];
  const topProducts = data?.top_products ?? [];

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
            <div className="admin-stat-card" onClick={() => navigate('/admin/orders')} style={{ cursor: 'pointer' }}>
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
            <div className="admin-stat-card" onClick={() => navigate('/admin/orders')} style={{ cursor: 'pointer' }}>
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
            <div className="admin-stat-card" onClick={() => navigate('/admin/products')} style={{ cursor: 'pointer' }}>
              <div className="admin-stat-icon orange">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
              <div className="admin-stat-value">{totalProducts.toLocaleString()}</div>
              <div className="admin-stat-label">Total Products</div>
            </div>

            {/* Total Customers */}
            <div className="admin-stat-card" onClick={() => navigate('/admin/customers')} style={{ cursor: 'pointer' }}>
              <div className="admin-stat-icon purple">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <div className="admin-stat-value">{totalCustomers.toLocaleString()}</div>
              <div className="admin-stat-label">Total Customers</div>
            </div>

            {/* Total Sellers */}
            <div className="admin-stat-card" onClick={() => navigate('/admin/sellers')} style={{ cursor: 'pointer' }}>
              <div className="admin-stat-icon purple">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M20 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                </svg>
              </div>
              <div className="admin-stat-value">{totalSellers.toLocaleString()}</div>
              <div className="admin-stat-label">Total Sellers</div>
            </div>
          </>
        )}
      </div>

      {/* ── Diagnostic / System Status ── */}
      {!loading && diag && (
        <div className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-title">Product Check / System Status</p>
              <p className="admin-section-subtitle">Live diagnostics for product visibility</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
             <div className="diag-item">
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Logged in as</label>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{diag.user}</span>
             </div>
             <div className="diag-item">
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Total Products (DB)</label>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{diag.total_items}</span>
             </div>
             <div className="diag-item">
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Published on Website</label>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{diag.website_items}</span>
             </div>
             <div className="diag-item">
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block' }}>Disabled Total</label>
                <span style={{ fontSize: 13, fontWeight: 600, color: diag.disabled_items > 0 ? '#ef4444' : 'inherit' }}>{diag.disabled_items}</span>
             </div>
          </div>
          {diag.total_items === 0 && (
            <div style={{ marginTop: 12, padding: 10, background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
              <strong>Zero products found:</strong> Please add products in the backend or check if the site is correct.
            </div>
          )}
          {!diag.has_item_read_permission && (
            <div style={{ marginTop: 12, padding: 10, background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 6, fontSize: 12, color: '#991b1b' }}>
              <strong>Permission denied:</strong> Your user account does not have read permissions for the "Item" doctype.
            </div>
          )}
        </div>
      )}

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
                    {inr(product.selling_price ?? product.standard_rate ?? 0)}
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
