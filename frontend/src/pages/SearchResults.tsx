import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { allProducts } from '../data/allProducts';
import ProductCard from '../components/ProductCard';
import Footer from '../components/Footer';
import '../styles/ProductListing.css';

const SearchResults: React.FC = () => {
    const [searchParams] = useSearchParams();
    const rawQuery = searchParams.get('q') || '';
    const query = rawQuery.toLowerCase().trim();

    // Mapping common synonyms and handling misspellings
    const getSynonyms = (q: string) => {
        const synonyms: { [key: string]: string[] } = {
            'laptop': ['macbook', 'computer', 'pc'],
            'tv': ['television', 'led', 'screen'],
            'refrigerator': ['fridge', 'refrigirator', 'cool'],
            'fridge': ['refrigerator', 'refrigirator'],
            'mobile': ['phone', 'iphone', 'smartphone'],
            'phone': ['mobile', 'iphone', 'smartphone'],
            'saree': ['sari', 'traditional', 'gown'],
            'sari': ['saree', 'traditional'],
            'men': ['mens', 'male', 'boy'],
            'women': ['womens', 'female', 'girl'],
            'kids': ['child', 'baby', 'infant']
        };
        return synonyms[q] || [];
    };

    const searchTerms = [query, ...getSynonyms(query)];

    const filteredProducts = allProducts.filter(product => {
        const productContent = [
            product.name,
            product.category,
            product.gender || '',
            ...(product.tags || [])
        ].join(' ').toLowerCase();

        return searchTerms.some(term => productContent.includes(term));
    });

    return (
        <div className="product-listing-page search-results">
            <div className="listing-container container">
                <div className="page-header fade-in">
                    <h1>Search Results for <span>"{rawQuery}"</span></h1>
                    <p>Found {filteredProducts.length} items matching your search</p>
                </div>

                {filteredProducts.length > 0 ? (
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
                            <p>Try searching for something else like "saree", "laptop", "tv" or "fridge"</p>
                        </div>
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
};

export default SearchResults;
