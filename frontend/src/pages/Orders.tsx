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
    description?: string;
}

interface Order {
    name: string;
    customer_name?: string;
    customer_mobile?: string;
    delivery_address?: string;
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

function stripHtml(html?: string): string {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getVariantAttrs(item: OrderItem): string {
    // Try description first (ERPNext stores variant attrs there)
    const desc = stripHtml(item.description);
    if (desc && desc !== item.item_name) return desc;
    // Fall back to item_code suffix (e.g. "Kurti-Purple-XL" → "Purple · XL")
    const code = item.item_code || '';
    const baseName = (item.item_name || '').toLowerCase().replace(/\s+/g, '-');
    const suffix = code.toLowerCase().startsWith(baseName)
        ? code.slice(baseName.length).replace(/^[-_]+/, '')
        : '';
    if (suffix) return suffix.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' · ');
    return '';
}

function daysSince(dateStr?: string): number {
    if (!dateStr) return 999;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function canRequestReturn(order: Order): boolean {
    const ecom = order.ecom_status;
    if (ecom === 'Credit Note Issued' || ecom === 'Cancelled') return false;
    if (ecom !== 'Delivered' && ecom !== 'On the Way') return false;
    if (order.actual_delivery_date) return daysSince(order.actual_delivery_date) <= 7;
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
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
    const [actionMsg, setActionMsg] = useState<Record<string, string>>({});
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnReason, setReturnReason] = useState('');
    const [returnItems, setReturnItems] = useState<Array<{item_code: string; item_name: string; qty: number; selected: boolean; returnQty: number}>>([]);

    const fetchOrders = () => {
        const mobile = localStorage.getItem('checkout_mobile') || '';
        const params = mobile ? `?mobile=${encodeURIComponent(mobile)}` : '';
        setLoading(true);
        fetch(`${BASE}/api/method/store_customizations.api.orders.get_my_orders${params}`, {
            credentials: 'include',
            headers: { 'X-Frappe-CSRF-Token': getCSRF() },
        })
            .then(r => r.json())
            .then(data => setOrders(data.message || []))
            .catch(() => setError('Could not load orders. Please try again.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchOrders(); }, []);

    // Keep selectedOrder in sync with fresh data after actions
    useEffect(() => {
        if (!selectedOrder) return;
        const fresh = orders.find(o => o.name === selectedOrder.name);
        if (fresh) setSelectedOrder(fresh);
    }, [orders]);

    const handleCancelOrder = async (orderName: string) => {
        if (!confirm('Cancel this order?')) return;
        setActionLoading(p => ({ ...p, [orderName]: true }));
        try {
            const res = await fetch(`${BASE}/api/method/store_customizations.api.orders.cancel_order`, {
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
            const res = await fetch(`${BASE}/api/method/store_customizations.api.orders.request_return`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Frappe-CSRF-Token': getCSRF() },
                body: (() => {
                    const p = new URLSearchParams({ sales_order: orderName, reason: returnReason });
                    const sel = returnItems.filter(i => i.selected && i.returnQty > 0);
                    if (sel.length > 0) p.set('items', JSON.stringify(sel.map(i => ({ item_code: i.item_code, qty: i.returnQty }))));
                    return p.toString();
                })(),
            });
            const data = await res.json();
            if (data.message?.return_invoice) {
                setShowReturnModal(false);
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

    // ── Order detail drawer ───────────────────────────────────────────
    const renderDetailPanel = () => {
        if (!selectedOrder) return null;
        const o = selectedOrder;
        const ecom = o.ecom_status || 'Pending';
        const statusStyle = STATUS_MAP[ecom] || STATUS_MAP['Pending'];
        const isCOD = (o.payment_method || '').toLowerCase() === 'cod';
        const isPaid = o.payment_status === 'Paid';
        const returnAllowed = canRequestReturn(o);
        const returnDeadline = (() => {
            if (ecom !== 'Delivered' && ecom !== 'On the Way') return null;
            if (!o.actual_delivery_date) return null;
            const days = daysSince(o.actual_delivery_date);
            return days > 7 ? null : 7 - days;
        })();

        const subtotal = o.items.reduce((sum, i) => sum + (i.amount || 0), 0);
        const deliveryFee = Math.round((o.grand_total || 0) - subtotal);

        return (
            <div className="order-detail-overlay" onClick={() => setSelectedOrder(null)}>
                <div className="order-detail-panel" onClick={e => e.stopPropagation()}>
                    {/* Panel header */}
                    <div className="odp-header">
                        <div className="odp-header-left">
                            <span className="odp-order-id">Order #{o.name}</span>
                            <span className="odp-date">{formatDate(o.transaction_date)}</span>
                        </div>
                        <div className="odp-header-right">
                            <span className="ecom-status-badge" style={{ color: statusStyle.color, background: statusStyle.bg }}>
                                {statusStyle.label}
                            </span>
                            <button className="odp-close-btn" onClick={() => setSelectedOrder(null)}>✕</button>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="odp-progress-wrap">
                        <OrderProgressBar ecom_status={ecom} />
                    </div>

                    <div className="odp-body">
                        {/* Delivery details */}
                        <div className="odp-section">
                            <div className="odp-section-title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                Delivery Details
                            </div>
                            <div className="odp-delivery-grid">
                                {o.customer_name && (
                                    <div className="odp-delivery-row">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        <span className="odp-delivery-label">Name</span>
                                        <span className="odp-delivery-val">{o.customer_name}</span>
                                    </div>
                                )}
                                {o.customer_mobile && (
                                    <div className="odp-delivery-row">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
                                        <span className="odp-delivery-label">Mobile</span>
                                        <span className="odp-delivery-val">+91 {o.customer_mobile}</span>
                                    </div>
                                )}
                                {o.delivery_address && (
                                    <div className="odp-delivery-row odp-addr-row">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                        <span className="odp-delivery-label">Address</span>
                                        <span className="odp-delivery-val">{o.delivery_address}</span>
                                    </div>
                                )}
                                {o.delivery_date && ecom !== 'Delivered' && ecom !== 'Cancelled' && (
                                    <div className="odp-delivery-row">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                        <span className="odp-delivery-label">Expected</span>
                                        <span className="odp-delivery-val">{formatDate(o.delivery_date)}</span>
                                    </div>
                                )}
                                {o.actual_delivery_date && (
                                    <div className="odp-delivery-row">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                                        <span className="odp-delivery-label">Delivered</span>
                                        <span className="odp-delivery-val" style={{ color: '#059669' }}>{formatDate(o.actual_delivery_date)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Items */}
                        <div className="odp-section">
                            <div className="odp-section-title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                                Items ({o.items.length})
                            </div>
                            {o.items.length === 0 ? (
                                <p style={{ color: '#9ca3af', fontSize: 13 }}>No item details</p>
                            ) : (
                                o.items.map((item, idx) => (
                                    <div key={idx} className="odp-item">
                                        <div className="odp-item-img">
                                            {item.image ? (
                                                <img src={item.image} alt={item.item_name} />
                                            ) : (
                                                <div className="odp-item-img-placeholder">
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="odp-item-info">
                                            <div className="odp-item-name">{item.item_name || item.item_code}</div>
                                            <div className="odp-item-meta">
                                                Qty: {item.qty}
                                                {item.rate > 0 && <span> · ₹{item.rate.toLocaleString('en-IN')} each</span>}
                                            </div>
                                        </div>
                                        <div className="odp-item-amount">
                                            ₹{(item.amount || 0).toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Price details */}
                        <div className="odp-section odp-price-section">
                            <div className="odp-section-title">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                Price Details
                            </div>
                            <div className="odp-price-row">
                                <span>Subtotal ({o.items.length} item{o.items.length !== 1 ? 's' : ''})</span>
                                <span>₹{subtotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="odp-price-row">
                                <span>Delivery</span>
                                <span className={deliveryFee <= 0 ? 'odp-free' : ''}>
                                    {deliveryFee <= 0 ? 'FREE' : `₹${deliveryFee.toLocaleString('en-IN')}`}
                                </span>
                            </div>
                            <div className="odp-price-divider" />
                            <div className="odp-price-row odp-price-total">
                                <span>Total</span>
                                <span>₹{(o.grand_total || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="odp-payment-method">
                                Payment: {isCOD ? (isPaid ? 'Cash on Delivery (Paid)' : 'Cash on Delivery') : (o.payment_method || '—')}
                                {isCOD && (
                                    <span className={`payment-badge ${isPaid ? 'paid' : 'cod-unpaid'}`} style={{ marginLeft: 8 }}>
                                        {isPaid ? '✓ Paid' : 'Unpaid'}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="odp-actions">
                            {returnDeadline !== null && ecom !== 'Credit Note Issued' && (
                                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 6 }}>
                                    Return window: {returnDeadline} day{returnDeadline !== 1 ? 's' : ''} left
                                </div>
                            )}
                            {o.sales_invoice && (
                                <a
                                    href={`${BASE}/api/method/store_customizations.api.orders.download_invoice_pdf?sales_order=${encodeURIComponent(o.name)}`}
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
                                    disabled={actionLoading[o.name]}
                                    onClick={() => handleCancelOrder(o.name)}
                                >
                                    {actionLoading[o.name] ? 'Cancelling…' : 'Cancel Order'}
                                </button>
                            )}
                            {ecom === 'Credit Note Issued' && (
                                <span className="return-submitted-badge">Credit Note: {o.return_invoice}</span>
                            )}
                            {returnAllowed && !showReturnModal && (
                                <button
                                    className="order-action-btn return-btn"
                                    onClick={() => {
                                        setReturnItems(o.items.map(item => ({
                                            item_code: item.item_code,
                                            item_name: item.item_name || item.item_code,
                                            qty: item.qty,
                                            selected: true,
                                            returnQty: item.qty,
                                        })));
                                        setShowReturnModal(true);
                                    }}
                                >
                                    Request Return
                                </button>
                            )}
                            {!returnAllowed && (ecom === 'Delivered' || ecom === 'On the Way') && (
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>Return window expired</span>
                            )}
                            {actionMsg[o.name] && (
                                <p className="order-action-msg">{actionMsg[o.name]}</p>
                            )}
                        </div>

                        {/* Return reason form (inline in panel) */}
                        {showReturnModal && (
                            <div className="odp-return-section">
                                <div className="odp-section-title" style={{ marginBottom: 8 }}>Return Request</div>
                                {returnDeadline !== null && (
                                    <p style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, marginBottom: 8 }}>
                                        Return window: {returnDeadline} day{returnDeadline !== 1 ? 's' : ''} left
                                    </p>
                                )}
                                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Select items to return:</p>
                                <div className="return-items-list">
                                    {returnItems.map((item, idx) => (
                                        <div key={item.item_code} className="return-item-row">
                                            <input
                                                type="checkbox"
                                                id={`ri-${idx}`}
                                                checked={item.selected}
                                                onChange={e => setReturnItems(prev => prev.map((it, i) =>
                                                    i === idx ? { ...it, selected: e.target.checked } : it
                                                ))}
                                            />
                                            <label htmlFor={`ri-${idx}`} className="return-item-name">{item.item_name}</label>
                                            {item.selected && item.qty > 1 && (
                                                <div className="return-qty-ctrl">
                                                    <button type="button" onClick={() => setReturnItems(prev => prev.map((it, i) =>
                                                        i === idx ? { ...it, returnQty: Math.max(1, it.returnQty - 1) } : it
                                                    ))}>−</button>
                                                    <span>{item.returnQty}</span>
                                                    <button type="button" onClick={() => setReturnItems(prev => prev.map((it, i) =>
                                                        i === idx ? { ...it, returnQty: Math.min(it.qty, it.returnQty + 1) } : it
                                                    ))}>+</button>
                                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>/ {item.qty}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <textarea
                                    className="return-reason-input"
                                    rows={3}
                                    placeholder="Reason for return (required)..."
                                    value={returnReason}
                                    onChange={e => setReturnReason(e.target.value)}
                                    style={{ marginTop: 10 }}
                                />
                                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                    <button className="order-action-btn" onClick={() => { setShowReturnModal(false); setReturnReason(''); }}>Close</button>
                                    <button
                                        className="order-action-btn return-btn"
                                        disabled={!returnReason.trim() || returnItems.every(i => !i.selected) || actionLoading[o.name]}
                                        onClick={() => handleRequestReturn(o.name)}
                                    >
                                        {actionLoading[o.name] ? 'Submitting…' : 'Submit Return'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────

    return (
        <div className="orders-page">
            <div className="orders-container container">
                <div className="orders-header">
                    <h2>My Orders</h2>
                </div>

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
                            const statusStyle = STATUS_MAP[ecom] || STATUS_MAP['Pending'];
                            const isCOD = (order.payment_method || '').toLowerCase() === 'cod';
                            const isPaid = order.payment_status === 'Paid';
                            const firstItem = order.items[0];
                            const extraCount = order.items.length - 1;
                            const attrs = firstItem ? getVariantAttrs(firstItem) : '';

                            return (
                                <div
                                    key={order.name}
                                    className="order-card-compact glass-effect"
                                    onClick={() => { setSelectedOrder(order); setShowReturnModal(false); setReturnReason(''); }}
                                >
                                    <div className="occ-body">
                                        {/* First item thumbnail */}
                                        <div className="occ-main-thumb">
                                            {firstItem?.image ? (
                                                <img src={firstItem.image} alt={firstItem.item_name} />
                                            ) : (
                                                <div className="occ-thumb-placeholder">
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Item name + attrs + date */}
                                        <div className="occ-info">
                                            <div className="occ-item-name">
                                                {firstItem?.item_name || '—'}
                                                {extraCount > 0 && <span className="occ-extra"> +{extraCount} more</span>}
                                            </div>
                                            {attrs && <div className="occ-attrs">{attrs}</div>}
                                            <div className="occ-date">{formatDate(order.transaction_date)}</div>
                                        </div>

                                        {/* Right: status + total + chevron */}
                                        <div className="occ-right">
                                            <span className="ecom-status-badge" style={{ color: statusStyle.color, background: statusStyle.bg }}>
                                                {statusStyle.label}
                                            </span>
                                            {isCOD && (
                                                <span className={`payment-badge ${isPaid ? 'paid' : 'cod-unpaid'}`}>
                                                    {isPaid ? '✓ Paid' : 'COD'}
                                                </span>
                                            )}
                                            <div className="occ-total">₹{(order.grand_total || 0).toLocaleString('en-IN')}</div>
                                            <svg className="occ-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {renderDetailPanel()}

            <Footer />
        </div>
    );
};

export default Orders;
