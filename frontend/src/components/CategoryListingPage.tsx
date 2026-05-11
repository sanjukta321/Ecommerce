import React, { useState } from 'react';
import Footer from './Footer';
import ProductCard from './ProductCard';
import { useFrappeProducts } from '../hooks/useFrappeProducts';
import '../styles/ProductListing.css';

interface Props {
  titlePrefix: string;
  titleHighlight: string;
  subtitle: string;
  frappeCategory: string;
  subcategories: string[];
  keywords: Record<string, string[]>;
}

const CategoryListingPage: React.FC<Props> = ({
  titlePrefix,
  titleHighlight,
  subtitle,
  frappeCategory,
  subcategories,
  keywords,
}) => {
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [sortBy, setSortBy] = useState('popular');
  const { products: liveProducts, loading } = useFrappeProducts(frappeCategory);

  const filteredProducts = (() => {
    let products = liveProducts;

    if (selectedSubcategory !== 'All') {
      const kws = keywords[selectedSubcategory.toLowerCase()] ?? [selectedSubcategory.toLowerCase()];
      products = products.filter(p => {
        const searchIn = [
          (p.name || '').toLowerCase(),
          (p.category || '').toLowerCase(),
          ...(p.tags || []).map((t: string) => t.toLowerCase()),
        ];
        return kws.some(kw => searchIn.some(s => s.includes(kw)));
      });
    }

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
          <h1>{titlePrefix} <span>{titleHighlight}</span></h1>
          <p>{subtitle}</p>
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
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: '#f1f5f9', borderRadius: 12, height: 320, animation: 'shimmer 1.4s infinite' }} />
            ))
          ) : filteredProducts.length === 0 ? (
            <div className="no-results" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 0' }}>
              <p>No products found in this category.</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CategoryListingPage;
