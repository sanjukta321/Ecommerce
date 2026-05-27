import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import Footer from '../components/Footer';
import '../styles/Cart.css';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

const Cart: React.FC = () => {
    const navigate = useNavigate();
    const { cart, removeFromCart, updateQuantity, clearCart, cartTotal } = useCart();
    const { addToWishlist, isWishlisted } = useWishlist();

    const totalQty = cart.reduce((a, i) => a + i.quantity, 0);

    const handleMoveToWishlist = (item: typeof cart[0]) => {
        addToWishlist({ id: item.id, name: item.name, price: item.price, image: item.image });
        removeFromCart(item.id, item.size);
    };

    const [couponInput, setCouponInput] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponMsg, setCouponMsg] = useState('');
    const [couponValid, setCouponValid] = useState(false);
    const [appliedCoupon, setAppliedCoupon] = useState<string>(() => localStorage.getItem('applied_coupon') || '');

    const handleApplyCoupon = async () => {
        const code = couponInput.trim().toUpperCase();
        if (!code) { setCouponMsg('Enter a coupon code'); return; }
        setCouponLoading(true);
        setCouponMsg('');
        try {
            const res = await fetch(
                `${BASE}/api/method/store_customizations.api.checkout.validate_coupon?coupon_code=${encodeURIComponent(code)}`,
                { credentials: 'include' }
            );
            const data = await res.json();
            if (data.message?.valid) {
                setAppliedCoupon(code);
                localStorage.setItem('applied_coupon', code);
                setCouponValid(true);
                setCouponMsg(`✓ Coupon applied! ${data.message.description || data.message.coupon_name}`);
            } else {
                const err = data.exception?.split('\n').pop() || data.exc_type || 'Invalid coupon';
                setCouponMsg(typeof err === 'string' ? err.replace(/^["\[]+|["\]]+$/g, '') : 'Invalid coupon');
                setCouponValid(false);
            }
        } catch {
            setCouponMsg('Could not validate coupon. Try again.');
            setCouponValid(false);
        } finally {
            setCouponLoading(false);
        }
    };

    const handleRemoveCoupon = () => {
        setAppliedCoupon('');
        setCouponInput('');
        setCouponMsg('');
        setCouponValid(false);
        localStorage.removeItem('applied_coupon');
    };

    if (cart.length === 0) {
        return (
            <div className="cart-page">
                <div className="container">
                    <div className="empty-cart fade-in">
                        <div className="empty-cart-icon">🛒</div>
                        <h2>Your cart is empty</h2>
                        <p>Looks like you haven't added anything yet. Let's fix that!</p>
                        <button className="premium-btn" onClick={() => navigate('/')}>
                            Continue Shopping
                        </button>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    const deliveryFee = cartTotal > 500 ? 0 : 99;
    const orderTotal = cartTotal + deliveryFee;

    return (
        <div className="cart-page">
            <div className="container cart-container">
                <div className="cart-header fade-in">
                    <h1>Shopping Cart <span>({totalQty} {totalQty === 1 ? 'item' : 'items'})</span></h1>
                    <button className="clear-cart-btn" onClick={clearCart}>Clear All</button>
                </div>

                <div className="cart-layout fade-in">
                    {/* Cart Items */}
                    <div className="cart-items">
                        {cart.map((item) => (
                            <div key={`${item.id}-${item.size}`} className="cart-item glass-effect">
                                <div
                                    className="item-image"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/product/${item.id}`)}
                                >
                                    <img src={item.image} alt={item.name} />
                                </div>
                                <div className="item-details">
                                    <h3
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/product/${item.id}`)}
                                    >{item.name}</h3>
                                    <p className="item-size">Size: <span>{item.size}</span></p>
                                    <p className="item-price">₹{item.price.toLocaleString('en-IN')}</p>
                                    <button
                                        className={`save-for-later-btn${isWishlisted(item.id) ? ' wishlisted' : ''}`}
                                        onClick={() => handleMoveToWishlist(item)}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill={isWishlisted(item.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                        {isWishlisted(item.id) ? 'Saved to Wishlist' : 'Save for Later'}
                                    </button>
                                </div>
                                <div className="item-controls">
                                    <div className="qty-controls">
                                        <button onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}>−</button>
                                        <span>{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}>+</button>
                                    </div>
                                    <p className="item-subtotal">₹{(item.price * item.quantity).toLocaleString('en-IN')}</p>
                                    <button
                                        className="remove-item-btn"
                                        onClick={() => removeFromCart(item.id, item.size)}
                                        title="Remove"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Order Summary */}
                    <div className="order-summary glass-effect">
                        <h2>Order Summary</h2>

                        <div className="summary-rows">
                            <div className="summary-row">
                                <span>Subtotal ({cart.reduce((a, i) => a + i.quantity, 0)} items)</span>
                                <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="summary-row">
                                <span>Delivery</span>
                                <span className={deliveryFee === 0 ? 'free-delivery' : ''}>
                                    {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
                                </span>
                            </div>
                            {deliveryFee === 0 && (
                                <div className="savings-tag">🎉 You saved ₹99 on delivery!</div>
                            )}
                        </div>

                            {/* Coupon section */}
                            <div className="coupon-section">
                                {appliedCoupon ? (
                                    <div className="coupon-applied-row">
                                        <span className="coupon-applied-tag">🏷 {appliedCoupon}</span>
                                        <button className="coupon-remove-btn" onClick={handleRemoveCoupon}>✕</button>
                                    </div>
                                ) : (
                                    <div className="coupon-input-row">
                                        <input
                                            type="text"
                                            className="coupon-input"
                                            placeholder="Coupon code"
                                            value={couponInput}
                                            onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponMsg(''); }}
                                            onKeyDown={e => e.key === 'Enter' && handleApplyCoupon()}
                                        />
                                        <button
                                            className="coupon-apply-btn"
                                            onClick={handleApplyCoupon}
                                            disabled={couponLoading || !couponInput.trim()}
                                        >
                                            {couponLoading ? '...' : 'Apply'}
                                        </button>
                                    </div>
                                )}
                                {couponMsg && (
                                    <p className={`coupon-msg ${couponValid ? 'coupon-msg-valid' : 'coupon-msg-error'}`}>
                                        {couponMsg}
                                    </p>
                                )}
                            </div>

                        <div className="summary-divider" />

                        <div className="summary-row total-row">
                            <span>Total</span>
                            <span>₹{orderTotal.toLocaleString('en-IN')}</span>
                        </div>

                        <button className="premium-btn checkout-btn" onClick={() => navigate('/checkout')}>
                            Proceed to Checkout
                        </button>
                        <button className="continue-shopping-btn" onClick={() => navigate('/')}>
                            ← Continue Shopping
                        </button>

                        <div className="trust-info">
                            <span>🔒 Secure Checkout</span>
                            <span>🚚 Free delivery over ₹500</span>
                            <span>↩️ 7-Day Returns</span>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default Cart;
