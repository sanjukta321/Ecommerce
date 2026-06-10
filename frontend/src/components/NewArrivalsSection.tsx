import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import '../styles/NewArrivalsSection.css';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface ApiItem {
    name: string;
    item_name: string;
    item_group: string;
    selling_price: number;
    standard_rate: number;
    image: string;
    images: string[];
}

const NewArrivalsSection: React.FC = () => {
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { toggleWishlist, isWishlisted } = useWishlist();

    const [products, setProducts] = useState<ApiItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${BASE}/api/method/store_customizations.api.products.get_all_products?is_new_arrival=1&limit=5`, {
            credentials: 'include',
        })
            .then(r => r.json())
            .then(d => setProducts(d?.message?.items ?? []))
            .catch(() => setProducts([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <section className="new-arrivals-section container">
            <div className="section-banner">
                <div className="banner-content">
                    <span className="badge">Limited Offer</span>
                    <h2>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:8}}>
                            <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                        Flat 40% OFF on New Arrivals
                    </h2>
                    <p>Launch Offer – Today Only. Don't miss out on the latest styles.</p>
                </div>
                <button className="banner-btn" onClick={() => navigate('/new-arrivals')}>Explore Now</button>
            </div>

            <div className="section-header">
                <div className="header-text">
                    <h2>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign:'middle',marginRight:8}}>
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        New Arrivals
                    </h2>
                    <p>Fresh Styles Just Landed. Explore the latest trends in fashion and gadgets.</p>
                </div>
                <button className="view-all-link" onClick={() => navigate('/new-arrivals')}>
                    Explore Full Collection →
                </button>
            </div>

            {loading && (
                <div className="new-product-grid">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="new-product-card-wrap">
                            <div className="new-product-card na-skeleton" />
                        </div>
                    ))}
                </div>
            )}

            {!loading && products.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)', fontSize: 15 }}>
                    No new arrivals yet. Check back soon!
                </div>
            )}

            {!loading && products.length > 0 && (
                <div className="new-product-grid">
                    {products.map((product) => {
                        const price = product.selling_price || product.standard_rate || 0;
                        const image = product.images?.[0] || product.image || '';
                        return (
                            <div key={product.name} className="new-product-card-wrap">
                                <div className="new-product-card" onClick={() => navigate(`/product/${product.name}`)} style={{ cursor: 'pointer' }}>
                                    <div className="product-image-container">
                                        <span className="new-badge">NEW</span>
                                        <img src={image} alt={product.item_name} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        <div className="quick-actions" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                className={`quick-btn wishlist ${isWishlisted(product.name) ? 'active' : ''}`}
                                                title={isWishlisted(product.name) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                                                onClick={() => toggleWishlist({ id: product.name, name: product.item_name, price, image })}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill={isWishlisted(product.name) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                            </button>
                                            <button className="quick-btn cart" title="Add to Cart" onClick={() => addToCart({ id: product.name, name: product.item_name, price, image, size: 'Default', quantity: 1 })}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                                            </button>
                                            <button className="quick-btn view" title="View Details" onClick={() => navigate(`/product/${product.name}`)}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="product-details">
                                        <span className="brand">{product.item_group}</span>
                                        <h3 title={product.item_name}>{product.item_name}</h3>
                                        <div className="price-info">
                                            <span className="price">₹{price.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="card-footer-actions">
                                            <button className="add-cart-btn" onClick={(e) => { e.stopPropagation(); addToCart({ id: product.name, name: product.item_name, price, image, size: 'Default', quantity: 1 }); }}>ADD TO CART</button>
                                            <button className="view-details-btn" onClick={() => navigate(`/product/${product.name}`)}>VIEW DETAILS</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default NewArrivalsSection;
