import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import '../styles/ProductCard.css';

interface ProductCardProps {
    id: string;
    name: string;
    price: string;
    image: string;
    rating?: number;
    category?: string;
}

const ProductCard: React.FC<ProductCardProps> = ({ id, name, price, image, rating = 4.5, category }) => {
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { toggleWishlist, isWishlisted } = useWishlist();

    const buildItem = () => ({
        id, name,
        price: parseFloat(price.replace(/[^\d.]/g, '')),
        image, size: 'Default', quantity: 1
    });

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        addToCart(buildItem());
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
        <div className="product-card glass-effect" style={{ display: 'flex', flexDirection: 'column' }}>
            <Link to={`/product/${id}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}>
                <div className="product-image">
                    <img src={image} alt={name} />
                    <button 
                        className={`wishlist-toggle ${isWishlisted(id) ? 'active' : ''}`} 
                        onClick={handleWishlist}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill={isWishlisted(id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                    </button>
                    <div className="product-overlay">
                        <button className="quick-add-btn" onClick={handleAddToCart}>
                            Quick Add
                        </button>
                    </div>
                    {category && <span className="category-badge">{category}</span>}
                </div>
                <div className="product-info">
                    <h3>{name}</h3>
                    <div className="rating">
                        {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
                        <span>({rating})</span>
                    </div>
                    <p className="price">{price}</p>
                </div>
            </Link>
            <div className="card-footer-actions">
                <button className="card-action-btn card-add-to-cart-btn" onClick={handleAddToCart}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.71a2 2 0 0 0 2-1.61l1.71-8.55H5.41"/></svg>
                    ADD TO CART
                </button>
                <button className="card-action-btn card-buy-now-btn" onClick={() => navigate(`/product/${id}`)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    VIEW DETAILS
                </button>
            </div>
        </div>
    );
};

export default ProductCard;
