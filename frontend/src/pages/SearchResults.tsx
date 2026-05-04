import React from 'react';
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

// ── Component ─────────────────────────────────────────────────────────────────

const SearchResults: React.FC = () => {
    const [searchParams] = useSearchParams();
    const rawQuery = searchParams.get('q') || '';

    const { products: frappeProducts, loading } = useFrappeProducts();

    // Merge Frappe + static, preferring Frappe when IDs overlap
    const frappeIds = new Set(frappeProducts.map(p => p.id));
    const merged: Product[] = [
        ...frappeProducts,
        ...allProducts.filter(p => !frappeIds.has(p.id)),
    ];

    const expandedTerms = expandQuery(rawQuery);

    const scored = merged
        .map(p => ({ product: p, score: scoreProduct(p, expandedTerms) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score);

    const filteredProducts = scored.map(x => x.product);

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
            </div>
            <Footer />
        </div>
    );
};

export default SearchResults;
