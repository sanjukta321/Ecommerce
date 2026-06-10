import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/Offers.css';
import '../styles/NewArrivals.css';
import Footer from '../components/Footer';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface ApiItem {
    name: string;
    item_name: string;
    item_group: string;
    selling_price: number;
    standard_rate: number;
    image: string;
    images: string[];
    gender?: string;
}


const NewArrivals: React.FC = () => {
    const initialFilters = {
        genders: [] as string[],
        categories: [] as string[],
        priceRange: null as string | null,
        sortBy: 'newest'
    };

    const [filters, setFilters] = useState(initialFilters);
    const [apiProducts, setApiProducts] = useState<ApiItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${BASE}/api/method/store_customizations.api.products.get_all_products?is_new_arrival=1&limit=50`, {
            credentials: 'include',
        })
            .then(r => r.json())
            .then(d => setApiProducts(d?.message?.items ?? []))
            .catch(() => setApiProducts([]))
            .finally(() => setLoading(false));
    }, []);

    const categories = ['Fashion', 'Electronics', 'Accessories', 'Sports', 'Furniture', 'Books'];
    const genders = ['Men', 'Women', 'Kids', 'Unisex'];
    const priceRanges = [
        { label: '₹500 to ₹1500', min: 500, max: 1500, id: 'range1' },
        { label: '₹1500 to ₹3000', min: 1500, max: 3000, id: 'range2' },
        { label: 'Above ₹3000', min: 3000, max: 1000000, id: 'range3' }
    ];

    const toggleFilter = (type: 'genders' | 'categories', value: string) => {
        setFilters(prev => {
            const current = (prev[type] as string[]);
            if (current.includes(value)) {
                return { ...prev, [type]: current.filter(v => v !== value) };
            }
            return { ...prev, [type]: [...current, value] };
        });
    };

    const clearFilters = () => setFilters(initialFilters);

    const hasFilters = filters.genders.length > 0 ||
        filters.categories.length > 0 ||
        filters.priceRange !== null;

    const filteredProducts = apiProducts.filter(p => {
        const price = p.selling_price || p.standard_rate || 0;
        const genderMatch = filters.genders.length === 0 || (p.gender && filters.genders.includes(p.gender));
        const categoryMatch = filters.categories.length === 0 || filters.categories.includes(p.item_group);

        let priceMatch = true;
        if (filters.priceRange) {
            const range = priceRanges.find(r => r.id === filters.priceRange);
            if (range) priceMatch = price >= range.min && price <= range.max;
        }

        return genderMatch && categoryMatch && priceMatch;
    });

    const sortedProducts = [...filteredProducts].sort((a, b) => {
        const pa = a.selling_price || a.standard_rate || 0;
        const pb = b.selling_price || b.standard_rate || 0;
        if (filters.sortBy === 'price-low') return pa - pb;
        if (filters.sortBy === 'price-high') return pb - pa;
        return 0;
    });

    const navigate = useNavigate();
    const { addToCart } = useCart();

    return (
        <div className="new-arrivals-page">
            <div className="container arrivals-container">
                <aside className="filters-sidebar">
                    <div className="sidebar-header">
                        <h3>FILTERS</h3>
                        {hasFilters && (
                            <button className="clear-all-btn" onClick={clearFilters}>
                                CLEAR ALL
                            </button>
                        )}
                    </div>

                    <div className="filter-section">
                        <h3>GENDER</h3>
                        {genders.map(g => (
                            <label key={g} className="filter-checkbox">
                                <input
                                    type="checkbox"
                                    checked={filters.genders.includes(g)}
                                    onChange={() => toggleFilter('genders', g)}
                                />
                                <span>{g}</span>
                            </label>
                        ))}
                    </div>

                    <div className="filter-section">
                        <h3>CATEGORIES</h3>
                        {categories.map(c => (
                            <label key={c} className="filter-checkbox">
                                <input
                                    type="checkbox"
                                    checked={filters.categories.includes(c)}
                                    onChange={() => toggleFilter('categories', c)}
                                />
                                <span>{c}</span>
                            </label>
                        ))}
                    </div>

                    <div className="filter-section">
                        <h3>PRICE RANGE</h3>
                        {priceRanges.map(range => (
                            <label key={range.id} className="filter-radio">
                                <input
                                    type="radio"
                                    name="price"
                                    checked={filters.priceRange === range.id}
                                    onChange={() => setFilters(prev => ({ ...prev, priceRange: range.id }))}
                                />
                                <span>{range.label}</span>
                            </label>
                        ))}
                    </div>
                </aside>

                <main className="arrivals-content">
                    <div className="content-header">
                        <div className="breadcrumbs">Home / <span>New Arrivals</span></div>
                        <div className="header-flex">
                            <h2>Latest Collection <span>- {loading ? '…' : `${sortedProducts.length} items`}</span></h2>
                            <div className="sort-dropdown">
                                <span>Sort by: </span>
                                <select
                                    value={filters.sortBy}
                                    onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="price-low">Price: Low to High</option>
                                    <option value="price-high">Price: High to Low</option>
                                    <option value="rating">Best Rated</option>
                                    <option value="popular">Popular</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {loading && (
                        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)' }}>
                            Loading new arrivals…
                        </div>
                    )}
                    {!loading && sortedProducts.length === 0 && (
                        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 15 }}>
                            No new arrivals found. Try adjusting your filters.
                        </div>
                    )}
                    <div className="arrivals-grid">
                        {sortedProducts.map(product => {
                            const price = product.selling_price || product.standard_rate || 0;
                            const image = product.images?.[0] || product.image || '';
                            return (
                                <div key={product.name} className="arrival-card" onClick={() => navigate(`/product/${product.name}`)} style={{ cursor: 'pointer' }}>
                                    <div className="card-media">
                                        <span className="arrival-badge">NEW</span>
                                        <img src={image} alt={product.item_name} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        <div className="hover-actions">
                                            <button className="h-btn" onClick={(e) => { e.stopPropagation(); addToCart({ id: product.name, name: product.item_name, price, image, size: 'Default', quantity: 1 }); }}>ADD TO CART</button>
                                            <button className="h-btn" onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.name}`); }}>VIEW DETAILS</button>
                                        </div>
                                    </div>
                                    <div className="card-data">
                                        <h3 className="b-name">{product.item_group}</h3>
                                        <p className="p-name">{product.item_name}</p>
                                        <div className="p-row">
                                            <span className="c-price">₹{price.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className="trust-badges">
                                            Free Shipping | 7 Days Return
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>
            </div>
            <Footer />
        </div>
    );
};

export default NewArrivals;
