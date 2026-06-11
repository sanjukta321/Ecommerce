import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/Lookbook.css';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface LookbookItem {
    name: string;
    item_name: string;
    item_group: string;
    standard_rate: number;
    selling_price?: number;
    image: string;
    images?: string[];
}

const SIZE_PATTERN = ['small', 'small', 'small', 'small', 'small', 'small', 'small', 'small'] as const;

const Lookbook: React.FC = () => {
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [items, setItems] = useState<LookbookItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${BASE}/api/method/store_customizations.api.products.get_all_products?limit=8`, {
            credentials: 'include',
        })
            .then(r => r.json())
            .then(d => setItems(d?.message?.items ?? []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <section className="lookbook container">
            <div className="section-header">
                <span className="subtitle">Visual Storytelling</span>
                <h2>The <span>Lookbook</span> Edition</h2>
            </div>

            {loading && (
                <div className="lookbook-grid">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="lookbook-card lookbook-skeleton" />
                    ))}
                </div>
            )}

            {!loading && items.length > 0 && (
                <div className="lookbook-grid">
                    {items.slice(0, 8).map((item, i) => {
                        const size = SIZE_PATTERN[i] ?? 'small';
                        const price = item.selling_price || item.standard_rate || 0;
                        const image = item.images?.[0] || item.image || '';
                        return (
                            <div
                                key={item.name}
                                className={`lookbook-card ${size}`}
                                onClick={() => navigate(`/product/${item.name}`)}
                            >
                                <div className="lookbook-image">
                                    <img
                                        src={image}
                                        alt={item.item_name}
                                        onError={e => {
                                            (e.target as HTMLImageElement).style.opacity = '0';
                                        }}
                                    />
                                </div>
                                <div className="lookbook-info">
                                    <span className="lookbook-cat">{item.item_group}</span>
                                    <div className="lookbook-title-row">
                                        <h3>{item.item_name}</h3>
                                        <span className="lookbook-price">₹{price.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="lookbook-actions">
                                        <button
                                            className="action-btn view-btn"
                                            onClick={e => { e.stopPropagation(); navigate(`/product/${item.name}`); }}
                                        >
                                            VIEW DETAILS
                                        </button>
                                        <button
                                            className="action-btn cart-btn"
                                            onClick={e => {
                                                e.stopPropagation();
                                                addToCart({ id: item.name, name: item.item_name, price, image, size: 'Default', quantity: 1 });
                                            }}
                                        >
                                            ADD TO CART
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {!loading && items.length === 0 && (
                <div className="lookbook-empty">No featured items to display.</div>
            )}
        </section>
    );
};

export default Lookbook;
