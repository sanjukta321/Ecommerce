import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface SalesOrder {
  name: string;
  customer_name: string;
  grand_total: number;
  status: string;
  transaction_date: string;
  delivery_date?: string;
}

type FilterTab = 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_OPTIONS = ['Draft', 'To Deliver and Bill', 'To Bill', 'To Deliver', 'Completed', 'Cancelled', 'Closed'];

function statusKey(s: string): FilterTab {
  const v = (s || '').toLowerCase();
  if (v.includes('deliver') || v.includes('complet')) return 'delivered';
  if (v.includes('cancel')) return 'cancelled';
  if (v.includes('ship') || v.includes('transit')) return 'shipped';
  if (v.includes('bill') || v.includes('process')) return 'processing';
  return 'pending';
}

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

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        '/api/resource/Sales%20Order?fields=["name","customer_name","grand_total","status","transaction_date","delivery_date"]&limit=200&order_by=transaction_date desc'
      );
      const data = await res.json();
      setOrders(data.data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const filtered = activeTab === 'all'
    ? orders
    : orders.filter(o => statusKey(o.status) === activeTab);

  // Stat counts
  const total = orders.length;
  const pending = orders.filter(o => statusKey(o.status) === 'pending').length;
  const shipped = orders.filter(o => statusKey(o.status) === 'shipped').length;
  const delivered = orders.filter(o => statusKey(o.status) === 'delivered').length;

  const handleStatusChange = async (orderName: string, newStatus: string) => {
    setUpdatingStatus(orderName);
    try {
      await apiFetch(`/api/resource/Sales%20Order/${encodeURIComponent(orderName)}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setOrders(prev => prev.map(o => o.name === orderName ? { ...o, status: newStatus } : o));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Status update failed.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const toggleExpand = (name: string) => {
    setExpandedRow(prev => prev === name ? null : name);
  };

  const skeletonRows = Array.from({ length: 7 });

  return (
    <AdminLayout title="Orders" subtitle="All customer orders">

      {/* Stats */}
      <div className="admin-stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-icon blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : total}</div>
          <div className="admin-stat-label">Total Orders</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : pending}</div>
          <div className="admin-stat-label">Pending</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : shipped}</div>
          <div className="admin-stat-label">Shipped</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : delivered}</div>
          <div className="admin-stat-label">Delivered</div>
        </div>
      </div>

      {/* Orders table section */}
      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title">Order List</h2>
            <p className="admin-section-subtitle">
              {loading ? '...' : `${filtered.length} order${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button className="admin-btn-primary" onClick={fetchOrders} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div className="admin-filter-tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`admin-filter-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key === 'all'
                ? ` (${orders.length})`
                : ` (${orders.filter(o => statusKey(o.status) === tab.key).length})`}
            </button>
          ))}
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                skeletonRows.map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}>
                        <div className="admin-skeleton" style={{ height: 16, borderRadius: 4 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="admin-empty">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <path d="M16 10a4 4 0 0 1-8 0"/>
                      </svg>
                      <h3>No orders found</h3>
                      <p>{activeTab !== 'all' ? `No ${activeTab} orders at the moment.` : 'No orders have been placed yet.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(order => {
                  const sk = statusKey(order.status);
                  const isExpanded = expandedRow === order.name;
                  return (
                    <>
                      <tr key={order.name} style={{ background: isExpanded ? '#f8fafc' : undefined }}>
                        <td style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', fontSize: 13 }}>
                          {order.name}
                        </td>
                        <td style={{ fontWeight: 500 }}>{order.customer_name || '—'}</td>
                        <td style={{ color: '#64748b', fontSize: 12 }}>—</td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>
                          ₹{(order.grand_total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className={`admin-badge ${sk}`}>
                            {order.status || 'Unknown'}
                          </span>
                        </td>
                        <td style={{ color: '#475569', fontSize: 13 }}>
                          {formatDate(order.transaction_date)}
                        </td>
                        <td>
                          <div className="admin-action-btns" style={{ alignItems: 'center' }}>
                            <select
                              className="admin-form-select"
                              style={{ fontSize: 12, padding: '5px 8px', minWidth: 130 }}
                              value={order.status}
                              disabled={updatingStatus === order.name}
                              onChange={e => handleStatusChange(order.name, e.target.value)}
                            >
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button
                              className="admin-btn-edit"
                              onClick={() => toggleExpand(order.name)}
                              title={isExpanded ? 'Collapse' : 'View Detail'}
                            >
                              {isExpanded ? 'Hide' : 'View'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${order.name}-detail`}>
                          <td colSpan={7} style={{ background: '#f8fafc', padding: '14px 24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Order ID</div>
                                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>{order.name}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Customer</div>
                                <div style={{ fontSize: 13 }}>{order.customer_name || '—'}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Order Date</div>
                                <div style={{ fontSize: 13 }}>{formatDate(order.transaction_date)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Delivery Date</div>
                                <div style={{ fontSize: 13 }}>{formatDate(order.delivery_date || '')}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Grand Total</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                                  ₹{(order.grand_total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Status</div>
                                <span className={`admin-badge ${statusKey(order.status)}`}>{order.status}</span>
                              </div>
                            </div>
                            <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
                              Item breakdown requires a separate API call to Sales Order Items. Open Frappe to view full line items.
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
