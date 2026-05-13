import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useWishlist, type WishlistItem } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import Footer from '../components/Footer';
import ShareModal from '../components/ShareModal';
import '../styles/Wishlist.css';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// ── Share helpers ─────────────────────────────────────────────────────────────

function buildShareUrl(ids: string[]): string {
    return `${window.location.origin}/wishlist?share=${ids.join(',')}`;
}

// ── Shared wishlist view (read-only) ──────────────────────────────────────────

const SharedWishlist: React.FC<{ ids: string[] }> = ({ ids }) => {
    const { addToWishlist, wishlist } = useWishlist();
    const [sharedItems, setSharedItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ids.length) { setLoading(false); return; }
        Promise.all(ids.map(id =>
            fetch(`${BASE}/api/method/store_customizations.api.products.get_product?item_code=${encodeURIComponent(id)}`, { credentials: 'include' })
                .then(r => r.json())
                .then(d => {
                    const p = d.message;
                    if (!p) return null;
                    const rate = p.selling_price ?? p.standard_rate ?? 0;
                    return { id: p.name, name: p.item_name || p.name, price: Number(rate), image: p.image || '' } as WishlistItem;
                })
                .catch(() => null)
        )).then(results => {
            setSharedItems(results.filter(Boolean) as WishlistItem[]);
            setLoading(false);
        });
    }, []);

    const inMyWishlist = new Set(wishlist.map(w => w.id));

    return (
        <div className="wishlist-page">
            <div className="wishlist-container container">
                <div className="wishlist-header shared-header">
                    <div>
                        <h2>Shared Wishlist <span>({ids.length} items)</span></h2>
                        <p className="shared-sub">Someone shared their wishlist with you</p>
                    </div>
                    <Link to="/wishlist" className="view-mine-btn">My Wishlist</Link>
                </div>
                {loading ? (
                    <div className="wishlist-grid">
                        {ids.map(id => <div key={id} className="wishlist-card-skeleton" />)}
                    </div>
                ) : sharedItems.length === 0 ? (
                    <div className="empty-wishlist card glass-effect">
                        <h3>No products found</h3>
                        <p>These items may no longer be available.</p>
                    </div>
                ) : (
                    <div className="wishlist-grid">
                        {sharedItems.map(item => (
                            <div key={item.id} className="wishlist-card card glass-effect">
                                <Link to={`/product/${item.id}`} className="item-image">
                                    <img src={item.image} alt={item.name} />
                                </Link>
                                <div className="item-details">
                                    <Link to={`/product/${item.id}`}><h3>{item.name}</h3></Link>
                                    <p className="item-price">₹{Number(item.price).toLocaleString()}</p>
                                    <div className="item-actions">
                                        <button
                                            className="add-to-cart-btn"
                                            onClick={() => addToWishlist(item)}
                                            disabled={inMyWishlist.has(item.id)}
                                        >
                                            {inMyWishlist.has(item.id) ? '✓ In Wishlist' : '+ Save to Wishlist'}
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

// ── Main component ────────────────────────────────────────────────────────────

const Wishlist: React.FC = () => {
    const [searchParams] = useSearchParams();
    const shareParam = searchParams.get('share');

    const { wishlist, removeFromWishlist, wishlistCount } = useWishlist();
    const { addToCart } = useCart();

    const [shareModal, setShareModal] = useState<{ url: string; title: string; text: string } | null>(null);

    // ── Shared view ──────────────────────────────────────────────────────────
    if (shareParam) {
        const ids = shareParam.split(',').map(s => s.trim()).filter(Boolean);
        return <SharedWishlist ids={ids} />;
    }

    const handleAddToCart = (item: WishlistItem) => {
        addToCart({ ...item, size: 'Default', quantity: 1 });
    };

    const handleShareItem = (item: WishlistItem) => {
        const url = `${window.location.origin}/product/${item.id}`;
        setShareModal({ url, title: item.name, text: `Check out ${item.name}` });
    };

    const handleShareWishlist = () => {
        if (!wishlist.length) return;
        const url = buildShareUrl(wishlist.map(w => w.id));
        setShareModal({
            url,
            title: 'My Wishlist',
            text: `Check out my wishlist (${wishlist.length} items)`,
        });
    };

    return (
        <div className="wishlist-page">
            <div className="wishlist-container container">
                <div className="wishlist-header">
                    <h2>My Wishlist <span>({wishlistCount} items)</span></h2>
                    {wishlist.length > 0 && (
                        <button className="share-wishlist-btn" onClick={handleShareWishlist} title="Share wishlist">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                            Share Wishlist
                        </button>
                    )}
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
                                <div className="card-top-actions">
                                    <button className="remove-btn" onClick={() => removeFromWishlist(item.id)} title="Remove from Wishlist">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                    </button>
                                    <button className="item-share-btn" onClick={() => handleShareItem(item)} title="Share this item">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                                    </button>
                                </div>
                                <Link to={`/product/${item.id}`} className="item-image">
                                    <img src={item.image} alt={item.name} />
                                </Link>
                                <div className="item-details">
                                    <Link to={`/product/${item.id}`}>
                                        <h3>{item.name}</h3>
                                    </Link>
                                    <p className="item-price">₹{Number(item.price).toLocaleString()}</p>
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

            {shareModal && (
                <ShareModal
                    url={shareModal.url}
                    title={shareModal.title}
                    text={shareModal.text}
                    onClose={() => setShareModal(null)}
                />
            )}

            <Footer />
        </div>
    );
};

export default Wishlist;
