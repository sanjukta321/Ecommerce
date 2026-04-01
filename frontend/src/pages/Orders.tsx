import React from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import '../styles/Orders.css';

interface OrderItem {
    id: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
}

interface Order {
    id: string;
    date: string;
    status: 'Delivered' | 'On the way' | 'Cancelled';
    total: number;
    items: OrderItem[];
}

const mockupOrders: Order[] = [
    {
        id: 'OD1234567890',
        date: 'Mar 25, 2026',
        status: 'Delivered',
        total: 1299,
        items: [
            {
                id: '1',
                name: 'Abstract Print Cotton Saree',
                image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&q=80',
                price: 1299,
                quantity: 1
            }
        ]
    }
];

const Orders: React.FC = () => {
    return (
        <div className="orders-page">
            <div className="orders-container container">
                <div className="orders-header">
                    <h2>My Orders</h2>
                </div>

                {mockupOrders.length === 0 ? (
                    <div className="empty-orders card glass-effect">
                        <div className="empty-icon">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                        </div>
                        <h3>You haven't ordered anything yet!</h3>
                        <p>Seems like you haven't bought anything yet.</p>
                        <Link to="/" className="shop-now-btn">Shop Now</Link>
                    </div>
                ) : (
                    <div className="orders-list">
                        {mockupOrders.map((order) => (
                            <div key={order.id} className="order-card card glass-effect">
                                <div className="order-header">
                                    <div className="order-id">
                                        <span>Order #</span>
                                        {order.id}
                                    </div>
                                    <div className="order-date">{order.date}</div>
                                </div>
                                <div className="order-items">
                                    {order.items.map((item) => (
                                        <div key={item.id} className="order-item">
                                            <div className="item-image">
                                                <img src={item.image} alt={item.name} />
                                            </div>
                                            <div className="item-info">
                                                <h3>{item.name}</h3>
                                                <p>Qty: {item.quantity}</p>
                                            </div>
                                            <div className="item-status">
                                                <span className={`status-badge ${order.status.toLowerCase().replace(/\s/g, '-')}`}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <div className="item-total">
                                                ₹{item.price.toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="order-footer">
                                    <div className="order-total">
                                        Total: <span>₹{order.total.toLocaleString()}</span>
                                    </div>
                                    <div className="order-actions">
                                        <button className="view-details-btn">View Details</button>
                                        <button className="track-order-btn">Track Order</button>
                                    </div>
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
