import React, { useState } from 'react';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { allProducts } from '../data/allProducts';
import '../styles/ProductListing.css';

const Sports: React.FC = () => {
    const [selectedSubcategory, setSelectedSubcategory] = useState('All');
    const [sortBy, setSortBy] = useState('popular');

    const subcategories = ['All', 'Cricket', 'Football', 'Gym', 'Tennis'];

    const filteredProducts = (() => {
        // Start with all Sports category products from central data
        let products = allProducts.filter(p => p.category === 'Sports');

        // Filter by subcategory tag if not 'All'
        if (selectedSubcategory !== 'All') {
            const subcatTag = selectedSubcategory.toLowerCase();
            products = products.filter(p =>
                p.tags?.some(tag => tag.toLowerCase().includes(subcatTag))
            );
        }

        // Apply Sorting
        const sorted = [...products];
        switch (sortBy) {
            case 'price-low':
                sorted.sort((a, b) =>
                    parseInt(a.price.replace(/[^\d]/g, '')) - parseInt(b.price.replace(/[^\d]/g, ''))
                );
                break;
            case 'price-high':
                sorted.sort((a, b) =>
                    parseInt(b.price.replace(/[^\d]/g, '')) - parseInt(a.price.replace(/[^\d]/g, ''))
                );
                break;
            case 'rating':
                sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            default:
                break;
        }

        return sorted;
    })();

    return (
        <div className="product-listing-page">
            <div className="listing-container container">
                <div className="page-header fade-in">
                    <h1>Elite <span>Performers</span></h1>
                    <p>Professional gear for the uncompromising athlete</p>
                </div>

                <div className="filters-bar glass-effect fade-in">
                    <div className="category-filters">
                        {subcategories.map((cat) => (
                            <button
                                key={cat}
                                className={`filter-btn ${selectedSubcategory === cat ? 'active' : ''}`}
                                onClick={() => setSelectedSubcategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <div className="sort-controls">
                        <label>Sort by:</label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="popular">Most Popular</option>
                            <option value="price-low">Price: Low to High</option>
                            <option value="price-high">Price: High to Low</option>
                            <option value="rating">Highest Rated</option>
                        </select>
                    </div>
                </div>

                <div className="products-grid fade-in">
                    {filteredProducts.map((product) => (
                        <ProductCard key={product.id} {...product} />
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="no-results" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0' }}>
                            <p>No products found in this category.</p>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default Sports;
