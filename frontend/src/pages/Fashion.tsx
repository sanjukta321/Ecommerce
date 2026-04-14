import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Footer from '../components/Footer';
import ProductCard from '../components/ProductCard';
import { useFrappeProducts } from '../hooks/useFrappeProducts';
import '../styles/ProductListing.css';

const Fashion: React.FC = () => {
    const { gender } = useParams<{ gender?: string }>();

    // Normalize category from URL or default to 'Women'
    const getInitialCategory = () => {
        if (!gender) return 'Women';
        const g = gender.toLowerCase();
        if (g === 'men') return 'Men';
        if (g === 'kids') return 'Kids';
        return 'Women';
    };

    const [selectedCategory, setSelectedCategory] = useState(getInitialCategory());
    const [selectedSubcategory, setSelectedSubcategory] = useState('All');

    // Update category when URL parameter changes
    useEffect(() => {
        if (gender) {
            const g = gender.toLowerCase();
            const newCat = g === 'men' ? 'Men' : g === 'kids' ? 'Kids' : 'Women';
            setSelectedCategory(newCat);
            setSelectedSubcategory('All');
        }
    }, [gender]);

    // Subcategories for each gender
    const menSubcategories = ['All', 'Shirts', 'Jeans', 'Pants', 'Blazers', 'Jackets', 'Shoes'];
    const womenSubcategories = ['All', 'Saree', 'Kurti', 'Bags', 'Cosmetics', 'Shoes'];
    const kidsSubcategories = ['All', 'Clothing', 'Shoes', 'Accessories'];

    // Get current subcategories based on selected category
    const getCurrentSubcategories = () => {
        switch (selectedCategory) {
            case 'Men':
                return menSubcategories;
            case 'Women':
                return womenSubcategories;
            case 'Kids':
                return kidsSubcategories;
            default:
                return [];
        }
    };

    const { products: fashionProducts, loading: fashionLoading } = useFrappeProducts('Fashion');
    const { products: sareeProducts, loading: sareeLoading } = useFrappeProducts('Saree');
    const { products: accessoryProducts, loading: accessoriesLoading } = useFrappeProducts('Accessories');
    const loading = fashionLoading || sareeLoading || accessoriesLoading;

    // Merge Fashion + Saree items (de-duplicate by id)
    const allFashionProducts = [
        ...fashionProducts,
        ...sareeProducts.filter(s => !fashionProducts.some(f => f.id === s.id)),
    ];

    // Keyword aliases: maps each subcategory to the terms we look for in item names/tags
    const SUBCATEGORY_KEYWORDS: Record<string, string[]> = {
        'saree':     ['saree', 'sari', 'silk saree', 'banarasi', 'kanjeevaram'],
        'kurti':     ['kurti', 'kurta', 'ethnic', 'traditional', 'salwar'],
        'bags':      ['bag', 'handbag', 'tote', 'clutch', 'purse', 'sling', 'backpack'],
        'cosmetics': ['cosmetic', 'makeup', 'skincare', 'beauty', 'lipstick', 'foundation', 'kit'],
        'shoes':     ['shoe', 'heel', 'boot', 'sandal', 'stiletto', 'footwear', 'sneaker'],
        'shirts':    ['shirt', 'top', 'blouse', 'tee'],
        'jeans':     ['jean', 'denim', 'trouser', 'pant', 'chino'],
        'pants':     ['pant', 'trouser', 'chino', 'formal', 'denim'],
        'blazers':   ['blazer', 'suit', 'formal', 'linen blend'],
        'jackets':   ['jacket', 'coat', 'bomber', 'biker'],
        'clothing':  ['clothing', 'wear', 'dress', 'outfit'],
        'accessories': ['accessory', 'accessories', 'jewellery', 'jewelry', 'watch', 'belt'],
    };

    const filteredProducts = (() => {
        let products = allFashionProducts;

        // Filter by main category (gender)
        if (selectedCategory === 'Accessories') {
            products = accessoryProducts;
        } else {
            products = products.filter(p => p.gender === selectedCategory);
        }

        // Filter by subcategory if not 'All' and not 'Accessories'
        if (selectedCategory !== 'Accessories' && selectedSubcategory !== 'All') {
            const key = selectedSubcategory.toLowerCase();
            const keywords = SUBCATEGORY_KEYWORDS[key] || [key];

            products = products.filter(p => {
                const searchIn = [
                    (p.name || '').toLowerCase(),
                    (p.category || '').toLowerCase(),
                    ...(p.tags || []).map((t: string) => t.toLowerCase()),
                ];
                return keywords.some(kw => searchIn.some(s => s.includes(kw)));
            });
        }

        return products;
    })();

    return (
        <div className="product-listing-page">
            <div className="listing-container container">
                <div className="page-header fade-in">
                    <h1>{selectedCategory}'s <span>Wear</span></h1>
                    <p>Curated styles for every occasion</p>
                </div>

                {/* Subcategory Filters - Show for Men, Women, and Kids */}
                {(selectedCategory === 'Men' || selectedCategory === 'Women' || selectedCategory === 'Kids') && (
                    <div className="filters-bar glass-effect fade-in subcategory-filters main-filters">
                        <div className="category-filters">
                            {getCurrentSubcategories().map((subcat) => (
                                <button
                                    key={subcat}
                                    className={`filter-btn ${selectedSubcategory === subcat ? 'active' : ''}`}
                                    onClick={() => setSelectedSubcategory(subcat)}
                                >
                                    {subcat}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="products-grid fade-in">
                    {loading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} style={{ background: '#f1f5f9', borderRadius: 12, height: 320, animation: 'shimmer 1.4s infinite' }} />
                        ))
                    ) : filteredProducts.length === 0 ? (
                        <div className="no-results">
                            <div className="no-results-content">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" />
                                </svg>
                                <h2>No Products Found</h2>
                                <p>We couldn't find any products in this category. Try adjusting your filters.</p>
                            </div>
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

export default Fashion;
