import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/Offers.css';
import '../styles/NewArrivals.css';
import Footer from '../components/Footer';

interface Product {
    id: string;
    brand: string;
    name: string;
    price: number;
    originalPrice?: number;
    discount?: number;
    image: string;
    category: string;
    gender: string;
    color: string;
    rating: number;
    reviews: number;
    isNew: boolean;
    tag?: string;
    size?: string[];
}

const newArrivalProducts: Product[] = [
    {
        id: 'n1',
        brand: 'Urban Elite',
        name: 'Oversized Graffiti Hoodie',
        price: 2499,
        originalPrice: 4999,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing',
        gender: 'Men',
        color: 'Black',
        rating: 4.8,
        reviews: 124,
        isNew: true,
        tag: 'Just Launched',
        size: ['S', 'M', 'L', 'XL']
    },
    {
        id: 'n2',
        brand: 'ZARA',
        name: 'Linen Blend Blazer',
        price: 5999,
        image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing',
        gender: 'Women',
        color: 'Beige',
        rating: 4.6,
        reviews: 89,
        isNew: true,
        tag: 'Trending',
        size: ['S', 'M', 'L']
    },
    {
        id: 'n3',
        brand: 'Roadster',
        name: 'High-Top Suede Sneakers',
        price: 3299,
        originalPrice: 4500,
        discount: 26,
        image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=600',
        category: 'Shoes',
        gender: 'Men',
        color: 'Brown',
        rating: 4.4,
        reviews: 215,
        isNew: true,
        tag: 'Latest',
        size: ['UK 7', 'UK 8', 'UK 9', 'UK 10']
    },
    {
        id: 'n4',
        brand: 'H&M',
        name: 'Relaxed Fit Cargo Pants',
        price: 2299,
        image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing',
        gender: 'Men',
        color: 'Olive',
        rating: 4.5,
        reviews: 340,
        isNew: true,
        tag: 'New',
        size: ['30', '32', '34', '36']
    },
    {
        id: 'n5',
        brand: 'Apple',
        name: 'Watch Ultra 2',
        price: 89900,
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600',
        category: 'Gadgets',
        gender: 'Unisex',
        color: 'Titanium',
        rating: 4.9,
        reviews: 1200,
        isNew: true,
        tag: 'Just Launched'
    },
    {
        id: 'n6',
        brand: 'Gap Kids',
        name: 'Colorblock Hooded Windbreaker',
        price: 1899,
        originalPrice: 2499,
        discount: 24,
        image: 'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing',
        gender: 'Kids',
        color: 'Blue',
        rating: 4.7,
        reviews: 56,
        isNew: true,
        tag: 'New'
    },
    {
        id: 'n7',
        brand: 'H&M Kids',
        name: 'Floral Print Tulle Dress',
        price: 1499,
        image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing',
        gender: 'Kids',
        color: 'Pink',
        rating: 4.8,
        reviews: 32,
        isNew: true,
        tag: 'Latest'
    },
    {
        id: 'n8',
        brand: 'Nike Kids',
        name: 'Revolution 6 Sneakers',
        price: 2999,
        originalPrice: 3995,
        discount: 25,
        image: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&q=80&w=600',
        category: 'Shoes',
        gender: 'Kids',
        color: 'Black',
        rating: 4.5,
        reviews: 128,
        isNew: true,
        tag: 'Trending'
    }
];

const NewArrivals: React.FC = () => {
    const initialFilters = {
        genders: [] as string[],
        categories: [] as string[],
        priceRange: null as string | null,
        sortBy: 'newest'
    };

    const [filters, setFilters] = useState(initialFilters);

    const categories = ['Clothing', 'Shoes', 'Gadgets', 'Accessories'];
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

    const filteredProducts = newArrivalProducts.filter(p => {
        const genderMatch = filters.genders.length === 0 || filters.genders.includes(p.gender);
        const categoryMatch = filters.categories.length === 0 || filters.categories.includes(p.category);

        let priceMatch = true;
        if (filters.priceRange) {
            const range = priceRanges.find(r => r.id === filters.priceRange);
            if (range) {
                priceMatch = p.price >= range.min && p.price <= range.max;
            }
        }

        return genderMatch && categoryMatch && priceMatch;
    });

    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (filters.sortBy === 'price-low') return a.price - b.price;
        if (filters.sortBy === 'price-high') return b.price - a.price;
        if (filters.sortBy === 'rating') return b.rating - a.rating;
        return 0; // Default: newest (order in array)
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
                            <h2>Latest Collection <span>- {sortedProducts.length} items</span></h2>
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

                    <div className="arrivals-grid">
                        {sortedProducts.map(product => (
                            <div key={product.id} className="arrival-card" onClick={() => navigate(`/product/${product.id}`)} style={{ cursor: 'pointer' }}>
                                <div className="card-media">
                                    <span className="arrival-badge">{product.tag || 'NEW'}</span>
                                    <img src={product.image} alt={product.name} />
                                    <div className="hover-actions">
                                        <button className="h-btn" onClick={(e) => { e.stopPropagation(); addToCart({ id: product.id, name: product.name, price: product.price, image: product.image, size: product.size?.[0] || 'Default', quantity: 1 }); }}>ADD TO CART</button>
                                        <button className="h-btn">VIEW DETAILS</button>
                                    </div>
                                </div>
                                <div className="card-data">
                                    <div className="rating-info">
                                        <span>{product.rating} ★ | {product.reviews}</span>
                                    </div>
                                    <h3 className="b-name">{product.brand}</h3>
                                    <p className="p-name">{product.name}</p>
                                    <div className="p-row">
                                        <span className="c-price">₹{product.price}</span>
                                        {product.originalPrice && (
                                            <>
                                                <span className="o-price">₹{product.originalPrice}</span>
                                                <span className="d-tag">({product.discount}% OFF)</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="trust-badges">
                                        Free Shipping | 7 Days Return
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            </div>
            <Footer />
        </div>
    );
};

export default NewArrivals;
