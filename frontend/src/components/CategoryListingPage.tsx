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

function parseMinPriceNum(price: string | number | undefined): number {
  if (price == null) return 0;
  if (typeof price === 'number') return price;
  const clean = price.replace(/[₹,\s]/g, '').split('–')[0].split('—')[0];
  return parseFloat(clean) || 0;
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
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 999999]);
  const [priceFilterActive, setPriceFilterActive] = useState(false);
  const { products: liveProducts, loading, loadingMore, hasMore, loadMore } = useFrappeProducts(frappeCategory);

  const priceMin = liveProducts.length > 0
    ? Math.floor(Math.min(...liveProducts.map(p => parseMinPriceNum(p.price))))
    : 0;
  const priceMax = liveProducts.length > 0
    ? Math.ceil(Math.max(...liveProducts.map(p => parseMinPriceNum(p.price))))
    : 999999;

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

    if (priceFilterActive) {
      products = products.filter(p => {
        const price = parseMinPriceNum(p.price);
        return price >= priceRange[0] && price <= priceRange[1];
      });
    }

    const sorted = [...products];
    switch (sortBy) {
      case 'price-low':
        sorted.sort((a, b) => parseMinPriceNum(a.price) - parseMinPriceNum(b.price));
        break;
      case 'price-high':
        sorted.sort((a, b) => parseMinPriceNum(b.price) - parseMinPriceNum(a.price));
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
          {!loading && liveProducts.length > 0 && priceMax > priceMin && (
            <div className="price-filter-group">
              <label>Price:</label>
              <span className="price-filter-val">₹{priceRange[0].toLocaleString('en-IN')}</span>
              <input
                type="range"
                className="price-range-slider"
                min={priceMin}
                max={priceMax}
                step={Math.max(1, Math.floor((priceMax - priceMin) / 100))}
                value={priceRange[1]}
                onChange={e => {
                  const val = Number(e.target.value);
                  setPriceRange([priceMin, val]);
                  setPriceFilterActive(val < priceMax);
                }}
              />
              <span className="price-filter-val">₹{priceRange[1].toLocaleString('en-IN')}</span>
              {priceFilterActive && (
                <button className="price-filter-reset" onClick={() => { setPriceRange([0, 999999]); setPriceFilterActive(false); }}>✕</button>
              )}
            </div>
          )}
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

        {hasMore && !loading && (
          <div style={{ textAlign: 'center', margin: '24px 0' }}>
            <button
              className="load-more-btn"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default CategoryListingPage;
