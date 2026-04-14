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
    status: string;
    grand_total: number;
    items: OrderItem[];
}

function statusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('complet') || s.includes('deliver')) return 'delivered';
    if (s.includes('ship') || s.includes('transit')) return 'on-the-way';
    return 'pending';
}

function statusLabel(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('cancel')) return 'Cancelled';
    if (s.includes('complet')) return 'Delivered';
    if (s.includes('deliver') && !s.includes('to deliver')) return 'Delivered';
    if (s.includes('ship') || s.includes('transit')) return 'On the way';
    return 'Pending';
}

function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

const Orders: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const mobile = localStorage.getItem('checkout_mobile') || '';
        const params = mobile ? `?mobile=${encodeURIComponent(mobile)}` : '';

        fetch(`${BASE}/api/method/store_customizations.api.get_my_orders${params}`, {
            credentials: 'include',
            headers: {
                'X-Frappe-CSRF-Token':
                    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 'fetch',
            },
        })
            .then(r => r.json())
            .then(data => {
                const list: Order[] = data.message || [];
                setOrders(list);
            })
            .catch(() => setError('Could not load orders. Please try again.'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="orders-page">
            <div className="orders-container container">
                <div className="orders-header">
                    <h2>My Orders</h2>
                </div>

                {loading ? (
                    <div className="empty-orders card glass-effect">
                        <p style={{ color: '#6b7280' }}>Loading your orders…</p>
                    </div>
                ) : error ? (
                    <div className="empty-orders card glass-effect">
                        <p style={{ color: '#ef4444' }}>{error}</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="empty-orders card glass-effect">
                        <div className="empty-icon">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                                <path d="M3 6h18" />
                                <path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                        </div>
                        <h3>You haven't ordered anything yet!</h3>
                        <p>Seems like you haven't bought anything yet.</p>
                        <Link to="/" className="shop-now-btn">Shop Now</Link>
                    </div>
                ) : (
                    <div className="orders-list">
                        {orders.map(order => (
                            <div key={order.name} className="order-card card glass-effect">
                                <div className="order-header">
                                    <div className="order-id">
                                        <span>Order #</span>
                                        {order.name}
                                    </div>
                                    <div className="order-date">{formatDate(order.transaction_date)}</div>
                                </div>

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
                                                <div className="item-status">
                                                    <span className={`status-badge ${statusClass(order.status)}`}>
                                                        {statusLabel(order.status)}
                                                    </span>
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
                                    {order.delivery_date && (
                                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                                            Expected by {formatDate(order.delivery_date)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
};

export default Orders;
