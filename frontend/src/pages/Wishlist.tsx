import React from 'react';
import { Link } from 'react-router-dom';
import { useWishlist, type WishlistItem } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import Footer from '../components/Footer';
import '../styles/Wishlist.css';

const Wishlist: React.FC = () => {
    const { wishlist, removeFromWishlist, wishlistCount } = useWishlist();
    const { addToCart } = useCart();

    const handleAddToCart = (item: WishlistItem) => {
        addToCart({
            ...item,
            size: 'Default',
            quantity: 1
        });
    };

    return (
        <div className="wishlist-page">
            <div className="wishlist-container container">
                <div className="wishlist-header">
                    <h2>My Wishlist <span>({wishlistCount} items)</span></h2>
                </div>

                {wishlist.length === 0 ? (
                    <div className="empty-wishlist card glass-effect">
                        <div className="empty-icon">
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                        </div>
                        <h3>Your wishlist is empty!</h3>
                        <p>Seems like you haven't added anything to your wishlist yet.</p>
                        <Link to="/" className="shop-now-btn">Shop Now</Link>
                    </div>
                ) : (
                    <div className="wishlist-grid">
                        {wishlist.map((item) => (
                            <div key={item.id} className="wishlist-card card glass-effect">
                                <button className="remove-btn" onClick={() => removeFromWishlist(item.id)} title="Remove from Wishlist">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                </button>
                                <Link to={`/product/${item.id}`} className="item-image">
                                    <img src={item.image} alt={item.name} />
                                </Link>
                                <div className="item-details">
                                    <Link to={`/product/${item.id}`}>
                                        <h3>{item.name}</h3>
                                    </Link>
                                    <p className="item-price">₹{item.price.toLocaleString()}</p>
                                    <div className="item-actions">
                                        <button className="add-to-cart-btn" onClick={() => handleAddToCart(item)}>
                                            Add to Cart
                                        </button>
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

export default Wishlist;
