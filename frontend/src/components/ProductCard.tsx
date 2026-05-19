import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import QuickOptionsModal from './QuickOptionsModal';
import '../styles/ProductCard.css';

interface ProductCardProps {
    id: string;
    name: string;
    price: string;
    image: string;
    images?: string[];
    rating?: number;
    category?: string;
    has_variants?: boolean;
    variant_count?: number;
    actual_qty?: number;
}


const ProductCard: React.FC<ProductCardProps> = ({ id, name, price, image, images, rating = 4.5, category, has_variants, variant_count, actual_qty }) => {
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { toggleWishlist, isWishlisted } = useWishlist();
    const { showToast } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [cardImageIdx, setCardImageIdx] = useState(0);
    const [isHoveringImage, setIsHoveringImage] = useState(false);

    const cardImages = images && images.length > 1 ? images : null;

    useEffect(() => {
        if (!cardImages) return;
        if (isHoveringImage) return;
        const timer = setInterval(() => {
            setCardImageIdx(i => (i + 1) % cardImages.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [cardImages, isHoveringImage]);

    const currentCardImage = cardImages ? (cardImages[cardImageIdx] ?? image) : image;

    const buildItem = () => ({
        id, name,
        price: parseFloat(price.replace(/[^\d.]/g, '')),
        image, size: 'Default', quantity: 1
    });

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (has_variants) {
            setShowModal(true);
            return;
        }
        addToCart(buildItem());
        showToast(`${name} added to cart!`, 'success');
    };

    const handleWishlist = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist({
            id, name,
            price: parseFloat(price.replace(/[^\d.]/g, '')),
            image
        });
    };

    return (
        <>
            <div className="product-card glass-effect" style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                    style={{ textDecoration: 'none', color: 'inherit', flex: 1, cursor: 'pointer' }}
                    onClick={() => navigate(`/product/${id}`)}
                >
                    <div
                        className="product-image"
                        onMouseEnter={() => setIsHoveringImage(true)}
                        onMouseLeave={() => setIsHoveringImage(false)}
                    >
                        <img
                            key={cardImageIdx}
                            src={currentCardImage}
                            alt={name}
                            className="card-slide-img"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        {cardImages && (
                            <>
                                <button
                                    className="card-slide-arrow card-slide-prev"
                                    onClick={e => { e.stopPropagation(); setCardImageIdx(i => (i - 1 + cardImages.length) % cardImages.length); }}
                                    aria-label="Previous image"
                                >‹</button>
                                <button
                                    className="card-slide-arrow card-slide-next"
                                    onClick={e => { e.stopPropagation(); setCardImageIdx(i => (i + 1) % cardImages.length); }}
                                    aria-label="Next image"
                                >›</button>
                                <div className="card-slide-dots">
                                    {cardImages.map((_, idx) => (
                                        <span
                                            key={idx}
                                            className={`card-slide-dot${cardImageIdx === idx ? ' active' : ''}`}
                                            onClick={e => { e.stopPropagation(); setCardImageIdx(idx); }}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                        <button
                            className={`wishlist-toggle ${isWishlisted(id) ? 'active' : ''}`}
                            onClick={handleWishlist}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill={isWishlisted(id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                        </button>
                        <div className="product-overlay">
                            <button className="quick-add-btn" onClick={handleAddToCart}>
                                {has_variants ? 'Select Options' : 'Quick Add'}
                            </button>
                        </div>
                        {actual_qty !== undefined && actual_qty <= 0 && (
                            <span className="sold-out-badge">Sold Out</span>
                        )}
                        {has_variants && variant_count && variant_count > 0 && (
                            <span className="variant-badge">{variant_count} variants</span>
                        )}
                        {category && <span className="category-badge">{category}</span>}
                    </div>
                    <div className="product-info">
                        <h3>{name}</h3>
                        <div className="rating" aria-label={`${rating} out of 5 stars`} role="img">
                            {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
                            <span>({rating})</span>
                        </div>
                        <p className="price">{price}</p>
                    </div>
                </div>
                <div className="card-footer-actions">
                    <button className="card-action-btn card-add-to-cart-btn" onClick={handleAddToCart}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.71a2 2 0 0 0 2-1.61l1.71-8.55H5.41" /></svg>
                        {has_variants ? 'SELECT OPTIONS' : 'ADD TO CART'}
                    </button>
                    <button className="card-action-btn card-buy-now-btn" onClick={() => navigate(`/product/${id}`)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        VIEW DETAILS
                    </button>
                </div>
            </div>

            {showModal && (
                <QuickOptionsModal
                    id={id}
                    name={name}
                    image={currentCardImage}
                    images={cardImages ?? undefined}
                    price={price}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    );
};

export default ProductCard;
