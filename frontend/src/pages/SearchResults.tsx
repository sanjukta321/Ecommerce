import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { allProducts } from '../data/allProducts';
import type { Product } from '../data/allProducts';
import { useFrappeProducts } from '../hooks/useFrappeProducts';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';
import '../styles/ProductListing.css';

// ── Search utilities ──────────────────────────────────────────────────────────

const SYNONYMS: Record<string, string[]> = {
    laptop:       ['macbook', 'notebook', 'computer', 'pc'],
    mobile:       ['phone', 'iphone', 'smartphone', 'android'],
    phone:        ['mobile', 'smartphone', 'iphone'],
    tv:           ['television', 'led tv', 'screen', 'monitor'],
    fridge:       ['refrigerator', 'refrigirator'],
    refrigerator: ['fridge'],
    saree:        ['sari', 'ethnic', 'silk'],
    sari:         ['saree', 'ethnic'],
    kurti:        ['kurta', 'ethnic top', 'salwar'],
    shoe:         ['sneaker', 'boot', 'footwear', 'sandal'],
    shoes:        ['sneakers', 'boots', 'footwear', 'sandals'],
    bag:          ['handbag', 'purse', 'tote', 'clutch'],
    watch:        ['timepiece', 'wristwatch'],
    men:          ['mens', "men's", 'male', 'gents'],
    women:        ['womens', "women's", 'female', 'ladies'],
    kids:         ['child', 'children', 'baby', 'junior'],
    tshirt:       ['t-shirt', 't shirt', 'top'],
    shirt:        ['top', 'blouse'],
    jean:         ['jeans', 'denim'],
    jeans:        ['jean', 'denim', 'trouser'],
    book:         ['novel', 'textbook', 'guide'],
};

function expandQuery(q: string): string[] {
    const base = q.toLowerCase().trim();
    const extra = SYNONYMS[base] ?? [];
    // Also check individual words for synonyms
    const wordExpansions = base.split(/\s+/).flatMap(w => SYNONYMS[w] ?? []);
    return [base, ...extra, ...wordExpansions].filter(Boolean);
}

/** Returns a relevance score > 0 if the product matches, 0 if not. */
function scoreProduct(product: Product, terms: string[]): number {
    const fields = [
        product.name,
        product.category,
        product.gender ?? '',
        ...(product.tags ?? []),
    ].join(' ').toLowerCase();

    let total = 0;
    for (const term of terms) {
        const tokens = term.split(/\s+/).filter(t => t.length >= 2);
        if (tokens.length === 0) continue;

        // Every token in the term must match something in the fields
        const termScore = tokens.reduce((acc, token) => {
            if (!fields.includes(token)) return 0;           // disqualify
            // Bonus for word-boundary (starts-with)
            const wordStart = new RegExp('(?:^|\\s|-)' + token).test(fields);
            return acc + (wordStart ? 3 : 1);
        }, 0);

        if (termScore > 0) total += termScore;
    }

    // Extra: exact name match or exact category match
    const query = terms[0];
    if (product.name.toLowerCase() === query) total += 10;
    if (product.category.toLowerCase() === query) total += 5;

    return total;
}

function parseMinPrice(price: string | number | undefined): number {
    if (price == null) return 0;
    if (typeof price === 'number') return price;
    const clean = price.replace(/[₹,\s]/g, '').split('–')[0].split('—')[0];
    return parseFloat(clean) || 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

const SearchResults: React.FC = () => {
    const [searchParams] = useSearchParams();
    const rawQuery = searchParams.get('q') || '';

    const { products: frappeProducts, loading, loadMore, loadingMore, hasMore } = useFrappeProducts();

    // Merge Frappe + static, preferring Frappe when IDs overlap
    const frappeIds = new Set(frappeProducts.map(p => p.id));
    const merged: Product[] = [
        ...frappeProducts,
        ...allProducts.filter(p => !frappeIds.has(p.id)),
    ];

    const expandedTerms = expandQuery(rawQuery);

    const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'name'>('relevance');
    const [selectedCategory, setSelectedCategory] = useState<string>('');

    const categories = useMemo(() => {
        const cats = new Set(merged.map(p => p.category).filter(Boolean));
        return Array.from(cats).sort();
    }, [merged.length]);

    const scored = useMemo(() => merged
        .map(p => ({ product: p, score: scoreProduct(p, expandedTerms) }))
        .filter(x => x.score > 0), [merged.length, rawQuery]);

    const filteredProducts = useMemo(() => {
        let results = [...scored];

        if (selectedCategory) {
            results = results.filter(x => x.product.category === selectedCategory);
        }

        switch (sortBy) {
            case 'price_asc':
                results.sort((a, b) => parseMinPrice(a.product.price) - parseMinPrice(b.product.price));
                break;
            case 'price_desc':
                results.sort((a, b) => parseMinPrice(b.product.price) - parseMinPrice(a.product.price));
                break;
            case 'name':
                results.sort((a, b) => a.product.name.localeCompare(b.product.name));
                break;
            default:
                results.sort((a, b) => b.score - a.score);
        }

        return results.map(x => x.product);
    }, [scored, sortBy, selectedCategory]);

    return (
        <div className="product-listing-page search-results">
            <div className="listing-container container">
                <div className="page-header fade-in">
                    <h1>Results for <span>"{rawQuery}"</span></h1>
                    {loading ? (
                        <p>Searching…</p>
                    ) : (
                        <p>Found {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</p>
                    )}
                </div>

                {!loading && scored.length > 0 && (
                    <div className="search-filter-bar fade-in">
                        <div className="search-filter-group">
                            <label>Category</label>
                            <select
                                value={selectedCategory}
                                onChange={e => setSelectedCategory(e.target.value)}
                                className="search-filter-select"
                            >
                                <option value="">All categories</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="search-filter-group">
                            <label>Sort by</label>
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                                className="search-filter-select"
                            >
                                <option value="relevance">Relevance</option>
                                <option value="price_asc">Price: Low to High</option>
                                <option value="price_desc">Price: High to Low</option>
                                <option value="name">Name A–Z</option>
                            </select>
                        </div>
                        {selectedCategory && (
                            <button className="search-filter-clear" onClick={() => setSelectedCategory('')}>
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="products-grid fade-in">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} style={{ background: '#f1f5f9', borderRadius: 12, height: 320, animation: 'shimmer 1.4s infinite' }} />
                        ))}
                    </div>
                ) : filteredProducts.length > 0 ? (
                    <div className="products-grid fade-in">
                        {filteredProducts.map(product => (
                            <ProductCard key={product.id} {...product} />
                        ))}
                    </div>
                ) : (
                    <div className="no-results fade-in">
                        <div className="no-results-content">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                                <line x1="8" y1="11" x2="14" y2="11" />
                            </svg>
                            <h2>No products found</h2>
                            <p>Try "saree", "t-shirt", "laptop", "watch" or a category like "Fashion"</p>
                        </div>
                    </div>
                )}
                {hasMore && !loading && filteredProducts.length > 0 && (
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

export default SearchResults;
