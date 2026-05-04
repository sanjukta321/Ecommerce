import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import '../styles/NewArrivalsSection.css';

interface Product {
    id: string;
    brand: string;
    name: string;
    price: number;
    originalPrice?: number;
    discount?: number;
    image: string;
    rating: number;
    reviews: number;
    isNew: boolean;
    tag?: string;
    freeShipping?: boolean;
}

const newProducts: Product[] = [
    {
        id: 'n1',
        brand: 'Urban Elite',
        name: 'Oversized Graffiti Hoodie',
        price: 2499,
        originalPrice: 4999,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&q=80&w=600',
        rating: 4.8,
        reviews: 124,
        isNew: true,
        tag: 'Just Launched',
        freeShipping: true
    },
    {
        id: 'n2',
        brand: 'ZARA',
        name: 'Linen Blend Blazer',
        price: 5999,
        image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=600',
        rating: 4.6,
        reviews: 89,
        isNew: true,
        tag: 'Trending',
        freeShipping: true
    },
    {
        id: 'n3',
        brand: 'Roadster',
        name: 'High-Top Suede Sneakers',
        price: 3299,
        originalPrice: 4500,
        discount: 26,
        image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=600',
        rating: 4.4,
        reviews: 215,
        isNew: true,
        tag: 'Latest'
    },
    {
        id: 'n4',
        brand: 'H&M',
        name: 'Relaxed Fit Cargo Pants',
        price: 2299,
        image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=600',
        rating: 4.5,
        reviews: 340,
        isNew: true,
        tag: 'New'
    },
    {
        id: 'n7',
        brand: 'H&M Kids',
        name: 'Floral Print Tulle Dress',
        price: 1499,
        image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=600',
        rating: 4.8,
        reviews: 32,
        isNew: true,
        tag: 'Latest'
    }
];

const NewArrivalsSection: React.FC = () => {
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { toggleWishlist, isWishlisted } = useWishlist();

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

            <div className="new-product-grid">
                {newProducts.map((product) => (
                    <div key={product.id} className="new-product-card-wrap">
                        <div className="new-product-card" onClick={() => navigate(`/product/${product.id}`)} style={{ cursor: 'pointer' }}>
                            <div className="product-image-container">
                                {product.isNew && <span className="new-badge">{product.tag || 'NEW'}</span>}
                                <img src={product.image} alt={product.name} />
                                <div className="quick-actions" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        className={`quick-btn wishlist ${isWishlisted(product.id) ? 'active' : ''}`}
                                        title={isWishlisted(product.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                                        onClick={() => toggleWishlist({ id: product.id, name: product.name, price: product.price, image: product.image })}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill={isWishlisted(product.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                    </button>
                                    <button className="quick-btn cart" title="Add to Cart" onClick={() => addToCart({ id: product.id, name: product.name, price: product.price, image: product.image, size: 'Default', quantity: 1 })}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                                    </button>
                                    <button className="quick-btn view" title="View Details" onClick={() => navigate(`/product/${product.id}`)}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                    </button>
                                </div>
                            </div>
                            <div className="product-details">
                                <span className="brand">{product.brand}</span>
                                <h3 title={product.name}>{product.name}</h3>
                                <div className="rating-row">
                                    <span className="stars">★★★★☆</span>
                                    <span className="count">({product.reviews})</span>
                                </div>
                                <div className="price-info">
                                    <span className="price">₹{product.price}</span>
                                    {product.originalPrice && <span className="original">₹{product.originalPrice}</span>}
                                    {product.discount && <span className="discount">({product.discount}% OFF)</span>}
                                </div>
                                {product.freeShipping && (
                                    <div className="info-strip">
                                        <span>Free Shipping | 7 Days Return</span>
                                    </div>
                                )}
                                <div className="card-footer-actions">
                                    <button className="add-cart-btn" onClick={(e) => { e.stopPropagation(); addToCart({ id: product.id, name: product.name, price: product.price, image: product.image, size: 'Default', quantity: 1 }); }}>ADD TO CART</button>
                                    <button className="view-details-btn" onClick={() => navigate(`/product/${product.id}`)}>VIEW DETAILS</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default NewArrivalsSection;
