import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import '../styles/Orders.css';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface OrderItem {
    item_code: string;
    item_name: string;
    qty: number;
    rate: number;
    amount: number;
    image?: string;
}

interface Order {
    name: string;
    transaction_date: string;
    delivery_date?: string;
    actual_delivery_date?: string;
    status: string;
    ecom_status: string;
    payment_method: string;
    payment_status: string;
    sales_invoice?: string;
    return_invoice?: string;
    delivery_note?: string;
    grand_total: number;
    items: OrderItem[];
    docstatus?: number;
}

// ecom_status values: Pending | Confirmed | On the Way | Delivered | Credit Note Issued | Cancelled
const STEPS = ['Pending', 'Confirmed', 'On the Way', 'Delivered'] as const;
type Step = typeof STEPS[number];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    'Pending':            { label: 'Pending',            color: '#d97706', bg: '#fef3c7' },
    'Confirmed':          { label: 'Confirmed',          color: '#2563eb', bg: '#dbeafe' },
    'On the Way':         { label: 'On the Way',         color: '#7c3aed', bg: '#ede9fe' },
    'Delivered':          { label: 'Delivered',          color: '#059669', bg: '#d1fae5' },
    'Credit Note Issued': { label: 'Credit Note Issued', color: '#b91c1c', bg: '#fee2e2' },
    'Cancelled':          { label: 'Cancelled',          color: '#dc2626', bg: '#fee2e2' },
};

type TabKey = 'All' | 'On the Way' | 'Delivered' | 'Cancelled' | 'Returns';
const TABS: TabKey[] = ['All', 'On the Way', 'Delivered', 'Cancelled', 'Returns'];

function formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function daysSince(dateStr?: string): number {
    if (!dateStr) return 999;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function canRequestReturn(order: Order): boolean {
    const ecom = order.ecom_status;
    if (ecom === 'Credit Note Issued' || ecom === 'Cancelled') return false;
    if (ecom !== 'Delivered' && ecom !== 'On the Way') return false;
    if (order.actual_delivery_date) {
        return daysSince(order.actual_delivery_date) <= 7;
    }
    return true;
}

const OrderProgressBar: React.FC<{ ecom_status: string }> = ({ ecom_status }) => {
    if (ecom_status === 'Cancelled') {
        return (
            <div className="order-progress cancelled-bar">
                <span className="cancelled-label">Order Cancelled</span>
            </div>
        );
    }
    const current = STEPS.indexOf(ecom_status as Step);
    return (
        <div className="order-progress">
            {STEPS.map((step, i) => (
                <React.Fragment key={step}>
                    <div className={`op-step ${i < current ? 'completed' : i === current ? 'active' : ''}`}>
                        <div className="op-dot">
                            {i <= current ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            ) : (
                                <span style={{ fontSize: 9, fontWeight: 700 }}>{i + 1}</span>
                            )}
                        </div>
                        <span className="op-label">{step}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                        <div className={`op-line ${i < current ? 'filled' : ''}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

const getCSRF = () =>
    (window as any).frappe?.csrf_token ||
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
    'fetch';

const Orders: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<TabKey>('All');
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    const [actionMsg, setActionMsg] = useState<Record<string, string>>({});
    const [showReturnModal, setShowReturnModal] = useState<string | null>(null);
    const [returnReason, setReturnReason] = useState('');

    const fetchOrders = () => {
        const mobile = localStorage.getItem('checkout_mobile') || '';
        const params = mobile ? `?mobile=${encodeURIComponent(mobile)}` : '';
        setLoading(true);
        fetch(`${BASE}/api/method/store_customizations.api.get_my_orders${params}`, {
            credentials: 'include',
            headers: { 'X-Frappe-CSRF-Token': getCSRF() },
        })
            .then(r => r.json())
            .then(data => setOrders(data.message || []))
            .catch(() => setError('Could not load orders. Please try again.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchOrders(); }, []);

    const handleCancelOrder = async (orderName: string) => {
        if (!confirm('Cancel this order?')) return;
        setActionLoading(p => ({ ...p, [orderName]: true }));
        try {
            const res = await fetch(`${BASE}/api/method/store_customizations.api.cancel_order`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Frappe-CSRF-Token': getCSRF() },
                body: new URLSearchParams({ sales_order: orderName }).toString(),
            });
            const data = await res.json();
            if (data.message?.cancelled) {
                setOrders(prev => prev.map(o =>
                    o.name === orderName ? { ...o, ecom_status: 'Cancelled' } : o
                ));
            } else {
                setActionMsg(p => ({ ...p, [orderName]: data.exc_type || 'Could not cancel.' }));
            }
        } catch {
            setActionMsg(p => ({ ...p, [orderName]: 'Network error.' }));
        } finally {
            setActionLoading(p => ({ ...p, [orderName]: false }));
        }
    };

    const handleRequestReturn = async (orderName: string) => {
        if (!returnReason.trim()) return;
        setActionLoading(p => ({ ...p, [orderName]: true }));
        try {
            const res = await fetch(`${BASE}/api/method/store_customizations.api.request_return`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Frappe-CSRF-Token': getCSRF() },
                body: new URLSearchParams({ sales_order: orderName, reason: returnReason }).toString(),
            });
            const data = await res.json();
            if (data.message?.return_invoice) {
                setShowReturnModal(null);
                setReturnReason('');
                fetchOrders();
            } else {
                setActionMsg(p => ({ ...p, [orderName]: data.exc_type || 'Could not submit return.' }));
            }
        } catch {
            setActionMsg(p => ({ ...p, [orderName]: 'Network error.' }));
        } finally {
            setActionLoading(p => ({ ...p, [orderName]: false }));
        }
    };

    const tabCount = (tab: TabKey) => {
        if (tab === 'All') return orders.length;
        if (tab === 'Returns') return orders.filter(o => o.ecom_status === 'Credit Note Issued').length;
        return orders.filter(o => o.ecom_status === tab).length;
    };

    const filteredOrders = orders.filter(o => {
        if (activeTab === 'All') return true;
        if (activeTab === 'Returns') return o.ecom_status === 'Credit Note Issued';
        return o.ecom_status === activeTab;
    });

    return (
        <div className="orders-page">
            <div className="orders-container container">
                <div className="orders-header">
                    <h2>My Orders</h2>
                </div>

                {/* Filter Tabs */}
                {!loading && !error && (
                    <div className="orders-tabs">
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                className={`orders-tab ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                                {tabCount(tab) > 0 && (
                                    <span className="tab-count">{tabCount(tab)}</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {loading ? (
                    <div className="empty-orders card glass-effect">
                        <p style={{ color: '#6b7280' }}>Loading your orders…</p>
                    </div>
                ) : error ? (
                    <div className="empty-orders card glass-effect">
                        <p style={{ color: '#ef4444' }}>{error}</p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="empty-orders card glass-effect">
                        <div className="empty-icon">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                                <path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                        </div>
                        <h3>{activeTab === 'All' ? "You haven't ordered anything yet!" : `No ${activeTab} orders`}</h3>
                        {activeTab === 'All' && <Link to="/" className="shop-now-btn">Shop Now</Link>}
                    </div>
                ) : (
                    <div className="orders-list">
                        {filteredOrders.map(order => {
                            const ecom = order.ecom_status || 'Pending';
                            const isCOD = (order.payment_method || '').toLowerCase() === 'cod';
                            const isPaid = order.payment_status === 'Paid';
                            const statusStyle = STATUS_MAP[ecom] || STATUS_MAP['Pending'];
                            const returnAllowed = canRequestReturn(order);
                            const returnDeadline = (() => {
                                if (ecom !== 'Delivered' && ecom !== 'On the Way') return null;
                                if (!order.actual_delivery_date) return null;
                                const days = daysSince(order.actual_delivery_date);
                                if (days > 7) return null;
                                return 7 - days;
                            })();

                            return (
                                <div key={order.name} className="order-card card glass-effect">
                                    <div className="order-header">
                                        <div className="order-id">
                                            <span>Order #</span>{order.name}
                                        </div>
                                        <div className="order-header-right">
                                            <div className="order-date">{formatDate(order.transaction_date)}</div>
                                            <span
                                                className="ecom-status-badge"
                                                style={{ color: statusStyle.color, background: statusStyle.bg }}
                                            >
                                                {statusStyle.label}
                                            </span>
                                            {isCOD && (
                                                <span className={`payment-badge ${isPaid ? 'paid' : 'cod-unpaid'}`}>
                                                    {isPaid ? '✓ Paid' : 'Cash on Delivery'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <OrderProgressBar ecom_status={ecom} />

                                    <div className="order-items">
                                        {order.items.length === 0 ? (
                                            <p style={{ color: '#9ca3af', fontSize: 13, padding: '8px 0' }}>No item details available</p>
                                        ) : (
                                            order.items.map((item, idx) => (
                                                <div key={idx} className="order-item">
                                                    <div className="item-image">
                                                        {item.image ? (
                                                            <img src={item.image} alt={item.item_name} />
                                                        ) : (
                                                            <div style={{ width: 64, height: 64, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                                                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                                                    <polyline points="21 15 16 10 5 21" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="item-info">
                                                        <h3>{item.item_name || item.item_code}</h3>
                                                        <p>Qty: {item.qty}</p>
                                                        <p style={{ fontSize: 12, color: '#6b7280' }}>
                                                            ₹{(item.rate || 0).toLocaleString('en-IN')} each
                                                        </p>
                                                    </div>
                                                    <div className="item-total">
                                                        ₹{(item.amount || 0).toLocaleString('en-IN')}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    <div className="order-footer">
                                        <div className="order-total">
                                            Total: <span>₹{(order.grand_total || 0).toLocaleString('en-IN')}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                            {order.delivery_date && ecom !== 'Delivered' && ecom !== 'Cancelled' && (
                                                <div style={{ fontSize: 12, color: '#6b7280' }}>
                                                    Expected by {formatDate(order.delivery_date)}
                                                </div>
                                            )}
                                            {order.actual_delivery_date && (
                                                <div style={{ fontSize: 12, color: '#059669' }}>
                                                    Delivered on {formatDate(order.actual_delivery_date)}
                                                </div>
                                            )}
                                            {returnDeadline !== null && ecom !== 'Credit Note Issued' && (
                                                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                                                    Return window: {returnDeadline} day{returnDeadline !== 1 ? 's' : ''} left
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="order-actions">
                                        {order.sales_invoice && (
                                            <a
                                                href={`${BASE}/api/method/store_customizations.api.download_invoice_pdf?sales_order=${encodeURIComponent(order.name)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="order-action-btn download-btn"
                                            >
                                                Download Invoice
                                            </a>
                                        )}
                                        {ecom === 'Pending' && (
                                            <button
                                                className="order-action-btn cancel-btn"
                                                disabled={actionLoading[order.name]}
                                                onClick={() => handleCancelOrder(order.name)}
                                            >
                                                {actionLoading[order.name] ? 'Cancelling…' : 'Cancel Order'}
                                            </button>
                                        )}
                                        {ecom === 'Credit Note Issued' && (
                                            <span className="return-submitted-badge">
                                                Credit Note: {order.return_invoice}
                                            </span>
                                        )}
                                        {returnAllowed && (
                                            <button
                                                className="order-action-btn return-btn"
                                                onClick={() => setShowReturnModal(order.name)}
                                            >
                                                Request Return
                                            </button>
                                        )}
                                        {!returnAllowed && (ecom === 'Delivered' || ecom === 'On the Way') && (
                                            <span style={{ fontSize: 11, color: '#9ca3af' }}>Return window expired</span>
                                        )}
                                        {actionMsg[order.name] && (
                                            <p className="order-action-msg">{actionMsg[order.name]}</p>
                                        )}
                                    </div>

                                    {showReturnModal === order.name && (
                                        <div className="return-modal-overlay" onClick={() => setShowReturnModal(null)}>
                                            <div className="return-modal" onClick={e => e.stopPropagation()}>
                                                <h3>Request Return</h3>
                                                <p style={{ fontSize: 13, color: '#6b7280' }}>
                                                    Tell us why you want to return this order.
                                                    {returnDeadline !== null && (
                                                        <span style={{ color: '#f59e0b', fontWeight: 600 }}> ({returnDeadline} day{returnDeadline !== 1 ? 's' : ''} left)</span>
                                                    )}
                                                </p>
                                                <textarea
                                                    className="return-reason-input"
                                                    rows={3}
                                                    placeholder="Reason for return..."
                                                    value={returnReason}
                                                    onChange={e => setReturnReason(e.target.value)}
                                                />
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                                                    <button className="order-action-btn" onClick={() => setShowReturnModal(null)}>Close</button>
                                                    <button
                                                        className="order-action-btn return-btn"
                                                        disabled={!returnReason.trim() || actionLoading[order.name]}
                                                        onClick={() => handleRequestReturn(order.name)}
                                                    >
                                                        {actionLoading[order.name] ? 'Submitting…' : 'Submit Return'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
};

export default Orders;
