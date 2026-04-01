import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/Lookbook.css';

const lookbookItems = [
    { id: 'L1', title: 'The Minimalist', category: 'Essentials', size: 'large', image: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&q=80&w=1200', price: '₹4,999' },
    { id: 'L2', title: 'Tech Core', category: 'Innovation', size: 'medium', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800', price: '₹12,499' },
    { id: 'L3', title: 'Modern Muse', category: 'Lifestyle', size: 'small', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800', price: '₹3,500' },
    { id: 'L4', title: 'Visionary', category: 'Accessories', size: 'tall', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800', price: '₹8,900' },
    { id: 'L5', title: 'Artisan Craft', category: 'Craftsmanship', size: 'small', image: 'https://images.unsplash.com/photo-1512314889357-e157c22f938d?auto=format&fit=crop&q=80&w=800', price: '₹6,700' },
    { id: 'L10', title: 'Modern Edge', category: 'Minimal', size: 'small', image: 'https://images.unsplash.com/photo-1491637639811-60e2756cc1c7?auto=format&fit=crop&q=80&w=800', price: '₹2,499' },
    { id: 'L6', title: 'Urban Rhythm', category: 'Vibes', size: 'medium', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=800', price: '₹5,900' },
    { id: 'L7', title: 'Pure Elegance', category: 'Luxury', size: 'small', image: 'https://images.unsplash.com/photo-1550246140-5119ae4790b8?auto=format&fit=crop&q=80&w=800', price: '₹15,000' },
    { id: 'L8', title: 'Studio Session', category: 'Production', size: 'small', image: 'https://images.unsplash.com/photo-1491933382434-500287f9b54b?auto=format&fit=crop&q=80&w=800', price: '₹7,200' },
    { id: 'L9', title: 'Studio Aura', category: 'Ambient', size: 'small', image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=800', price: '₹4,300' }

];

const Lookbook: React.FC = () => {
    const navigate = useNavigate();
    const { addToCart } = useCart();

    return (
        <section className="lookbook container">
            <div className="section-header">
                <span className="subtitle">Visual Storytelling</span>
                <h2>The <span>Lookbook</span> Edition</h2>
            </div>

            <div className="lookbook-grid">
                {lookbookItems.map((item) => (
                    <div
                        key={item.id}
                        className={`lookbook-card ${item.size} fade-in`}
                        onClick={() => navigate('/new-arrivals')}
                    >
                        <div className="lookbook-image">
                            <img src={item.image} alt={item.title} />
                        </div>
                        <div className="lookbook-info">
                            <span className="cat">{item.category}</span>
                            <div className="item-info-row">
                                <h3>{item.title}</h3>
                                <span className="price">{item.price}</span>
                            </div>
                            <div className="lookbook-actions">
                                <button
                                    className="action-btn view-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate('/new-arrivals');
                                    }}
                                >
                                    VIEW DETAILS
                                </button>
                                <button
                                    className="action-btn cart-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const numericPrice = parseFloat(item.price.replace(/[^\d.]/g, ''));
                                        addToCart({ id: item.id, name: item.title, price: numericPrice, image: item.image, size: 'Default', quantity: 1 });
                                    }}
                                >
                                    ADD TO CART
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Lookbook;
