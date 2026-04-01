import { useState, useEffect } from 'react';
import SellerLayout from '../../components/seller/SellerLayout';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface OrderItem {
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
}

interface SalesOrder {
  name: string;
  customer: string;
  grand_total: number;
  status: string;
  payment_status?: string;
  delivery_status?: string;
  transaction_date: string;
  total_qty?: number;
  items?: OrderItem[];
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-Frappe-CSRF-Token': 'fetch' },
    ...options,
  });
  return res.json() as Promise<T>;
}

const STATUS_TABS = ['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

function statusClass(status: string): string {
  const s = status?.toLowerCase();
  if (s?.includes('cancel')) return 'cancelled';
  if (s?.includes('complet') || s?.includes('deliver')) return 'delivered';
  if (s?.includes('ship') || s?.includes('transit')) return 'shipped';
  if (s?.includes('bill') || s?.includes('process')) return 'processing';
  return 'pending';
}

function payClass(status?: string): string {
  const s = (status || '').toLowerCase();
  if (s.includes('paid') || s.includes('complet')) return 'paid';
  return 'unpaid';
}

export default function SellerOrders() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: SalesOrder[] }>(
        '/api/resource/Sales Order?limit=100&order_by=creation desc&fields=["name","customer","grand_total","status","payment_status","delivery_status","transaction_date","total_qty"]'
      );
      setOrders(res.data || []);
    } catch {
      // backend offline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const loadOrderItems = async (orderName: string) => {
    if (orderItems[orderName]) return;
    try {
      const res = await apiFetch<{ data: { items: OrderItem[] } }>(
        `/api/resource/Sales Order/${encodeURIComponent(orderName)}`
      );
      setOrderItems(prev => ({ ...prev, [orderName]: res.data?.items || [] }));
    } catch {
      setOrderItems(prev => ({ ...prev, [orderName]: [] }));
    }
  };

  const toggleRow = (name: string) => {
    if (expandedRow === name) {
      setExpandedRow(null);
    } else {
      setExpandedRow(name);
      loadOrderItems(name);
    }
  };

  const updateStatus = async (orderName: string, status: string) => {
    setActionLoading(orderName + status);
    try {
      await apiFetch(`/api/resource/Sales Order/${encodeURIComponent(orderName)}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await loadOrders();
    } catch {
      // handle
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = orders.filter(o => {
    if (activeTab === 'All') return true;
    return statusClass(o.status) === activeTab.toLowerCase();
  });

  return (
    <SellerLayout title="Orders" subtitle="Manage and track customer orders">

      {/* Filter Tabs */}
      <div className="seller-filter-tabs">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            className={`seller-filter-tab${activeTab === tab ? ' active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === 'All' && (
              <span style={{ marginLeft: 6, background: '#e2e8f0', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700, color: '#6b7280' }}>
                {orders.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="seller-section">
        <div className="seller-section-header">
          <div>
            <h2 className="seller-section-title">Orders</h2>
            <p className="seller-section-subtitle">{filtered.length} orders</p>
          </div>
        </div>
        <div className="seller-table-wrapper">
          <table className="seller-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4,5,6,7,8].map(j => (
                      <td key={j}><div className="seller-skeleton seller-skeleton-row" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="seller-empty">
                      <div className="seller-empty-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/></svg>
                      </div>
                      <h3>No orders found</h3>
                      <p>No orders match this filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.flatMap(order => {
                  const rows = [
                    <tr
                      key={order.name}
                      className={expandedRow === order.name ? 'expanded' : ''}
                      onClick={() => toggleRow(order.name)}
                    >
                      <td style={{ fontWeight: 600, color: '#6c63ff', fontFamily: 'monospace', fontSize: 13 }}>
                        {order.name}
                        <span style={{ marginLeft: 6, color: '#9ca3af' }}>{expandedRow === order.name ? '▲' : '▼'}</span>
                      </td>
                      <td>{order.customer}</td>
                      <td>{order.total_qty ?? '—'}</td>
                      <td style={{ fontWeight: 700 }}>₹{(order.grand_total || 0).toLocaleString('en-IN')}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <span className={`seller-badge ${payClass(order.payment_status)}`}>
                          {order.payment_status || 'Unpaid'}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <span className={`seller-badge ${statusClass(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ color: '#8a94a6' }}>{order.transaction_date}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="seller-action-btns">
                          {statusClass(order.status) !== 'shipped' && statusClass(order.status) !== 'delivered' && statusClass(order.status) !== 'cancelled' && (
                            <button
                              className="seller-btn-outline sm"
                              disabled={actionLoading === order.name + 'To Deliver and Bill'}
                              onClick={() => updateStatus(order.name, 'To Deliver and Bill')}
                            >
                              Ship
                            </button>
                          )}
                          {statusClass(order.status) === 'shipped' && (
                            <button
                              className="seller-btn-success"
                              disabled={actionLoading === order.name + 'Completed'}
                              onClick={() => updateStatus(order.name, 'Completed')}
                            >
                              Deliver
                            </button>
                          )}
                          {statusClass(order.status) !== 'cancelled' && statusClass(order.status) !== 'delivered' && (
                            <button
                              className="seller-btn-danger"
                              disabled={actionLoading === order.name + 'Cancelled'}
                              onClick={() => updateStatus(order.name, 'Cancelled')}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,
                  ];

                  if (expandedRow === order.name) {
                    rows.push(
                      <tr key={order.name + '-expanded'} className="seller-expanded-row">
                        <td colSpan={8}>
                          <div className="seller-order-items">
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', marginBottom: 8 }}>Order Items:</div>
                            {!orderItems[order.name] ? (
                              <div className="seller-skeleton" style={{ height: 40, borderRadius: 8 }} />
                            ) : orderItems[order.name].length === 0 ? (
                              <div style={{ color: '#9ca3af', fontSize: 13 }}>No items data available</div>
                            ) : (
                              orderItems[order.name].map((item, idx) => (
                                <div className="seller-order-item" key={idx}>
                                  <span>{item.item_name}</span>
                                  <span style={{ color: '#6b7280' }}>Qty: {item.qty}</span>
                                  <span style={{ color: '#6b7280' }}>Rate: ₹{(item.rate || 0).toLocaleString('en-IN')}</span>
                                  <span style={{ fontWeight: 700 }}>₹{(item.amount || 0).toLocaleString('en-IN')}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </SellerLayout>
  );
}
