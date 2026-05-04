import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface SalesOrder {
  name: string;
  customer: string;
  customer_name: string;
  grand_total: number;
  status: string;
  ecom_status: string;
  payment_method: string;
  payment_status: string;
  sales_invoice?: string;
  delivery_note?: string;
  transaction_date: string;
  delivery_date?: string;
}

type FilterTab = 'all' | 'Pending' | 'Confirmed' | 'To Bill' | 'Completed';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Pending', label: 'Pending' },
  { key: 'Confirmed', label: 'Confirmed' },
  { key: 'To Bill', label: 'To Bill' },
  { key: 'Completed', label: 'Completed' },
];

let _csrfCache = '';

async function getCsrfToken(): Promise<string> {
  const win = window as any;
  if (win.frappe?.csrf_token && win.frappe.csrf_token !== 'None') return win.frappe.csrf_token;
  const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (meta && meta !== 'None') return meta;
  if (_csrfCache) return _csrfCache;
  try {
    const res = await fetch(`${BASE}/api/method/store_customizations.api.get_csrf_token`, { credentials: 'include' });
    const d = await res.json();
    _csrfCache = d.message || '';
    return _csrfCache;
  } catch {
    return '';
  }
}

async function apiFetch(path: string, options?: RequestInit) {
  const csrf = await getCsrfToken();

  // Convert JSON body → form-encoded. Frappe v15 CSRF validation is
  // reliable only with application/x-www-form-urlencoded, not JSON.
  let finalBody = options?.body;
  if (finalBody && typeof finalBody === 'string') {
    try {
      finalBody = new URLSearchParams(JSON.parse(finalBody) as Record<string, string>).toString();
    } catch { /* leave as-is */ }
  }

  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'X-Frappe-CSRF-Token': csrf,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: finalBody,
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

function ecomBadgeClass(ecom: string): string {
  if (ecom === 'Completed') return 'delivered';
  if (ecom === 'To Bill') return 'shipped';
  if (ecom === 'Confirmed') return 'processing';
  return 'pending';
}

export default function AdminOrders() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const customerFilter = searchParams.get('customer') || '';
  const customerNameLabel = searchParams.get('customer_name') || customerFilter;

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/method/store_customizations.api.get_admin_orders?limit=200');
      const data = await res.json();
      let list: SalesOrder[] = data.message || [];
      if (customerFilter) {
        list = list.filter(o => o.customer === customerFilter);
      }
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [customerFilter]);

  const filtered = activeTab === 'all'
    ? orders
    : orders.filter(o => o.ecom_status === activeTab);

  const counts = {
    total: orders.length,
    pending: orders.filter(o => o.ecom_status === 'Pending').length,
    confirmed: orders.filter(o => o.ecom_status === 'Confirmed').length,
    toBill: orders.filter(o => o.ecom_status === 'To Bill').length,
    completed: orders.filter(o => o.ecom_status === 'Completed').length,
  };

  const handleCreateDelivery = async (order: SalesOrder) => {
    if (!window.confirm(`Create Delivery Note for order ${order.name}?`)) return;
    setActionLoading(order.name + ':ship');
    try {
      const res = await apiFetch('/api/method/store_customizations.api.create_delivery_note', {
        method: 'POST',
        body: JSON.stringify({ sales_order: order.name }),
      });
      const data = await res.json();
      if (data.exc) throw new Error(data.exc_type || 'Error creating delivery note');
      alert(`Delivery Note created: ${data.message?.delivery_note || ''}`);
      await fetchOrders();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to create delivery note');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCollectCOD = async (order: SalesOrder) => {
    if (!order.sales_invoice) {
      alert('No Sales Invoice found for this order.');
      return;
    }
    if (!window.confirm(`Mark COD payment collected for order ${order.name}?\nInvoice: ${order.sales_invoice}`)) return;
    setActionLoading(order.name + ':pay');
    try {
      const res = await apiFetch('/api/method/store_customizations.api.collect_cod_payment', {
        method: 'POST',
        body: JSON.stringify({ sales_invoice: order.sales_invoice }),
      });
      const data = await res.json();
      if (data.exc) throw new Error(data.exc_type || 'Error recording payment');
      alert(`Payment Entry created: ${data.message?.payment_entry || ''}`);
      await fetchOrders();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to record payment');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = (name: string) => {
    setExpandedRow(prev => prev === name ? null : name);
  };

  const skeletonRows = Array.from({ length: 7 });
  const subtitle = customerFilter ? `Orders for: ${customerNameLabel}` : 'All customer orders';

  return (
    <AdminLayout title="Orders" subtitle={subtitle}>

      {customerFilter && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 20,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span style={{ fontSize: 13, color: '#1e40af', fontWeight: 600 }}>
            Showing orders for: {customerNameLabel}
          </span>
          <button
            onClick={() => navigate('/admin/orders')}
            style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            View all orders
          </button>
        </div>
      )}

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
          <div className="admin-stat-value">{loading ? '—' : counts.total}</div>
          <div className="admin-stat-label">Total Orders</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : counts.pending + counts.confirmed}</div>
          <div className="admin-stat-label">Awaiting Shipment</div>
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
          <div className="admin-stat-value">{loading ? '—' : counts.toBill}</div>
          <div className="admin-stat-label">Shipped (To Bill)</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <div className="admin-stat-value">{loading ? '—' : counts.completed}</div>
          <div className="admin-stat-label">Completed</div>
        </div>
      </div>

      {/* Orders table */}
      <div className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title">
              {customerFilter ? `${customerNameLabel}'s Orders` : 'Order List'}
            </h2>
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
                : ` (${orders.filter(o => o.ecom_status === tab.key).length})`}
            </button>
          ))}
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Payment</th>
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
                      <td key={j}><div className="admin-skeleton" style={{ height: 16, borderRadius: 4 }} /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="admin-empty">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <path d="M16 10a4 4 0 0 1-8 0"/>
                      </svg>
                      <h3>No orders found</h3>
                      <p>
                        {customerFilter
                          ? `${customerNameLabel} has no${activeTab !== 'all' ? ` ${activeTab}` : ''} orders.`
                          : activeTab !== 'all' ? `No ${activeTab} orders at the moment.` : 'No orders placed yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(order => {
                  const isExpanded = expandedRow === order.name;
                  const isCOD = (order.payment_method || '').toLowerCase() === 'cod';
                  const canShip = !order.delivery_note && ['Confirmed', 'Completed'].includes(order.ecom_status);
                  const canCollect = isCOD && order.ecom_status === 'To Bill' && order.payment_status !== 'Paid';
                  const isShipping = actionLoading === order.name + ':ship';
                  const isPaying = actionLoading === order.name + ':pay';

                  return (
                    <>
                      <tr key={order.name} style={{ background: isExpanded ? 'var(--primary-light, #f8fafc)' : undefined }}>
                        <td style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', fontSize: 13 }}>
                          {order.name}
                        </td>
                        <td style={{ fontWeight: 500 }}>{order.customer_name || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                              color: isCOD ? '#b45309' : '#1e40af',
                              background: isCOD ? 'rgba(234,179,8,0.1)' : 'rgba(59,130,246,0.08)',
                              padding: '2px 8px', borderRadius: 20, width: 'fit-content',
                            }}>
                              {isCOD ? 'COD' : (order.payment_method || 'COD').toUpperCase()}
                            </span>
                            {isCOD && (
                              <span style={{
                                fontSize: 10, fontWeight: 600,
                                color: order.payment_status === 'Paid' ? '#16a34a' : '#9a3412',
                              }}>
                                {order.payment_status === 'Paid' ? '✓ Collected' : 'Not collected'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, color: '#0f172a' }}>
                          ₹{(order.grand_total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td>
                          <span className={`admin-badge ${ecomBadgeClass(order.ecom_status)}`}>
                            {order.ecom_status || 'Pending'}
                          </span>
                        </td>
                        <td style={{ color: '#475569', fontSize: 13 }}>
                          {formatDate(order.transaction_date)}
                        </td>
                        <td>
                          <div className="admin-action-btns" style={{ flexWrap: 'wrap', gap: 6 }}>
                            {canShip && (
                              <button
                                className="admin-btn-primary"
                                style={{ fontSize: 11, padding: '5px 10px', whiteSpace: 'nowrap' }}
                                disabled={isShipping}
                                onClick={() => handleCreateDelivery(order)}
                                title="Create Delivery Note & mark Shipped"
                              >
                                {isShipping ? '…' : '🚚 Ship'}
                              </button>
                            )}
                            {canCollect && (
                              <button
                                className="admin-btn-primary"
                                style={{ fontSize: 11, padding: '5px 10px', background: '#16a34a', whiteSpace: 'nowrap' }}
                                disabled={isPaying}
                                onClick={() => handleCollectCOD(order)}
                                title="Record COD cash payment"
                              >
                                {isPaying ? '…' : '💰 Collect COD'}
                              </button>
                            )}
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                              {[
                                ['Order ID', order.name],
                                ['Customer', order.customer_name || '—'],
                                ['Order Date', formatDate(order.transaction_date)],
                                ['Delivery Date', formatDate(order.delivery_date || '')],
                                ['Payment Method', (order.payment_method || 'COD').toUpperCase()],
                                ['Payment Status', order.payment_status || '—'],
                                ['Sales Invoice', order.sales_invoice || '—'],
                                ['Delivery Note', order.delivery_note || '—'],
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                                  <div style={{ fontSize: 13, fontWeight: label === 'Order ID' ? 600 : 400, fontFamily: label === 'Order ID' ? 'monospace' : 'inherit' }}>{value}</div>
                                </div>
                              ))}
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Grand Total</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                                  ₹{(order.grand_total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
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
