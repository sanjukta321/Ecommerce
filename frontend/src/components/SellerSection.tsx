import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/SellerSection.css';

const sellers = [
    {
        initials: 'RE',
        name: 'Ravi Electronics',
        category: 'Electronics',
        rating: 4.8,
        products: 142,
        sales: '₹12.4L',
        color: '#6c63ff',
    },
    {
        initials: 'PF',
        name: 'Priya Fashion Hub',
        category: 'Fashion',
        rating: 4.9,
        products: 318,
        sales: '₹8.3L',
        color: '#ec4899',
    },
    {
        initials: 'KH',
        name: 'Kumar Home Decor',
        category: 'Furniture',
        rating: 4.7,
        products: 89,
        sales: '₹6.7L',
        color: '#f59e0b',
    },
    {
        initials: 'SB',
        name: 'Sports Bazaar',
        category: 'Sports',
        rating: 4.6,
        products: 203,
        sales: '₹9.1L',
        color: '#22c55e',
    },
];

const SellerSection: React.FC = () => {
    const navigate = useNavigate();

    return (
        <section className="seller-section">
            <div className="container">
                <div className="seller-section-header">
                    <h2>Our <span>Top Sellers</span></h2>
                    <p>Trusted sellers offering premium products with fast delivery and hassle-free returns</p>
                </div>

                <div className="seller-cards-grid">
                    {sellers.map((seller) => (
                        <div className="seller-card-front" key={seller.name}>
                            <div className="seller-avatar" style={{ background: seller.color }}>
                                {seller.initials}
                                <span className="verified-badge">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </span>
                            </div>

                            <div className="seller-name">{seller.name}</div>
                            <span className="seller-category-tag">{seller.category}</span>

                            <div className="seller-rating">
                                {'★'.repeat(Math.floor(seller.rating))}
                                {'☆'.repeat(5 - Math.floor(seller.rating))}
                                {' '}{seller.rating}
                            </div>

                            <div className="seller-stats-row">
                                <div className="seller-stat-item">
                                    <span className="s-value">{seller.products}</span>
                                    <span className="s-label">Products</span>
                                </div>
                                <div className="seller-stat-item">
                                    <span className="s-value">{seller.sales}</span>
                                    <span className="s-label">Total Sales</span>
                                </div>
                            </div>

                            <button
                                className="view-store-btn"
                                onClick={() => navigate('/become-seller')}
                            >
                                View Store →
                            </button>
                        </div>
                    ))}
                </div>

                {/* Become a Seller Banner */}
                <div className="become-seller-banner">
                    <div className="bsb-content">
                        <h3>Want to Sell on SB Store?</h3>
                        <p>Join 50,000+ sellers. List your products, reach crore of customers and grow your business — completely free to start.</p>
                    </div>
                    <div className="bsb-actions">
                        <button className="bsb-btn-primary" onClick={() => navigate('/seller/login')}>
                            Start Selling Now
                        </button>
                        <button className="bsb-btn-outline" onClick={() => navigate('/become-seller')}>
                            Learn More
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SellerSection;
