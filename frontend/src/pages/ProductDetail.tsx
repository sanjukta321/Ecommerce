import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { allProducts } from '../data/allProducts';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import Footer from '../components/Footer';
import '../styles/ProductDetail.css';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface FrappeItem {
    name: string;
    item_name: string;
    item_group: string;
    standard_rate: number;
    selling_price: number;
    image?: string;
    description?: string;
}

interface DisplayProduct {
    id: string;
    name: string;
    price: string;
    originalPrice: string;
    image: string;
    images: string[];
    category: string;
    rating: number;
    reviews: number;
    description: string;
    features: string[];
    specifications: Record<string, string>;
    tags?: string[];
}

const PLACEHOLDER = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000';
const EXTRA_IMAGES = [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000',
    'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&q=80&w=1000',
];

function buildDisplayFromFrappe(item: FrappeItem): DisplayProduct {
    const rate = item.selling_price || item.standard_rate || 0;
    const price = `₹${rate.toLocaleString('en-IN')}`;
    const originalPrice = `₹${Math.round(rate * 1.2).toLocaleString('en-IN')}`;
    const img = item.image
        ? (item.image.startsWith('http') ? item.image : BASE + item.image)
        : PLACEHOLDER;

    return {
        id: item.name,
        name: item.item_name || item.name,
        price,
        originalPrice,
        image: img,
        images: [img, ...EXTRA_IMAGES],
        category: item.item_group || 'General',
        rating: 4.5,
        reviews: 256,
        description: item.description && item.description !== item.item_name
            ? item.description
            : `Premium ${item.item_name} from our ${item.item_group || ''} collection. Designed for those who appreciate quality and style.`,
        features: [
            'Premium Build Quality',
            'Sleek and Modern Design',
            '1-Year Brand Warranty',
            'High Performance Materials',
            'Best-in-class features',
        ],
        specifications: {
            'Category': item.item_group || '—',
            'Model': item.item_name || item.name,
            'Warranty': '1 Year',
            'Material': 'Premium Grade',
            'Availability': 'In Stock',
        },
        tags: [],
    };
}

function buildDisplayFromStatic(p: typeof allProducts[0]): DisplayProduct {
    const numericRate = parseInt(p.price.replace(/[^\d]/g, ''), 10) || 0;
    return {
        id: p.id,
        name: p.name,
        price: p.price,
        originalPrice: `₹${Math.round(numericRate * 1.2).toLocaleString('en-IN')}`,
        image: p.image,
        images: [p.image, ...EXTRA_IMAGES],
        category: p.category,
        rating: p.rating,
        reviews: 456 + (p.name.length * 10),
        description: `Premium ${p.name} from our ${p.category} collection. Designed for those who appreciate quality and style.`,
        features: [
            'Premium Build Quality',
            'Sleek and Modern Design',
            '1-Year Brand Warranty',
            'High Performance Materials',
            'Best-in-class features',
        ],
        specifications: {
            'Category': p.category,
            'Model': p.name,
            'Warranty': '1 Year',
            'Material': 'Premium Grade',
            'Availability': 'In Stock',
        },
        tags: p.tags ?? [],
    };
}

const ProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { toggleWishlist, isWishlisted } = useWishlist();
    const [selectedSize, setSelectedSize] = useState('M');
    const [quantity, setQuantity] = useState(1);
    const [activeImage, setActiveImage] = useState(0);
    const [showSizeChart, setShowSizeChart] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false);

    const [product, setProduct] = useState<DisplayProduct | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        window.scrollTo(0, 0);
        setLoading(true);
        setActiveImage(0);

        if (!id) {
            setLoading(false);
            return;
        }

        // Try backend first
        fetch(
            `${BASE}/api/method/store_customizations.api.get_product?item_code=${encodeURIComponent(id)}`,
            {
                credentials: 'include',
                headers: {
                    'X-Frappe-CSRF-Token':
                        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 'fetch',
                },
            }
        )
            .then(r => r.json())
            .then(data => {
                const item: FrappeItem | undefined = data.message;
                if (item && item.name) {
                    setProduct(buildDisplayFromFrappe(item));
                } else {
                    throw new Error('not found in backend');
                }
            })
            .catch(() => {
                // Fallback: look up in static allProducts
                const staticItem = allProducts.find(p => p.id === id);
                setProduct(staticItem ? buildDisplayFromStatic(staticItem) : null);
            })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="product-detail-page">
                <div className="detail-container container" style={{ padding: '100px 0', textAlign: 'center' }}>
                    <p style={{ color: '#6b7280', fontSize: 16 }}>Loading product…</p>
                </div>
                <Footer />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="product-detail-page">
                <div className="detail-container container">
                    <div className="no-product-found fade-in" style={{ padding: '100px 0', textAlign: 'center' }}>
                        <h2>Product Not Found</h2>
                        <p>The product you are looking for does not exist or has been removed.</p>
                        <button className="premium-btn" onClick={() => navigate('/')} style={{ marginTop: '20px' }}>
                            Go Back Home
                        </button>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    const numericPrice = parseInt(product.price.replace(/[^\d]/g, ''), 10) || 0;

    return (
        <div className="product-detail-page">
            <div className="detail-container container">
                <div className="product-detail-grid fade-in">
                    {/* Image Gallery */}
                    <div className="image-gallery">
                        <div className="main-image">
                            <img src={product.images[activeImage]} alt={product.name} />
                        </div>
                        <div className="thumbnail-strip">
                            {product.images.map((img, idx) => (
                                <img
                                    key={idx}
                                    src={img}
                                    alt={`View ${idx + 1}`}
                                    className={activeImage === idx ? 'active' : ''}
                                    onClick={() => setActiveImage(idx)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Product Info */}
                    <div className="product-details">
                        <h1>{product.name}</h1>

                        <p className="product-short-description">{product.description}</p>

                        <div className="rating-section">
                            <div className="stars">
                                {'★'.repeat(Math.floor(product.rating))}{'☆'.repeat(5 - Math.floor(product.rating))}
                            </div>
                            <span className="rating-text">{product.rating} ({product.reviews} reviews)</span>
                        </div>

                        <div className="price-section">
                            <span className="current-price">{product.price}</span>
                            <span className="original-price">{product.originalPrice}</span>
                            <span className="discount">20% OFF</span>
                        </div>

                        <div className="offers-section glass-effect">
                            <h3>Available Offers</h3>
                            <ul>
                                <li>🎁 10% instant discount on HDFC Bank cards</li>
                                <li>💳 No cost EMI available on orders above ₹3000</li>
                                <li>🚚 Free delivery on orders above ₹500</li>
                            </ul>
                        </div>

                        {/* Size Selection */}
                        {(product.category === 'Fashion' || product.category === 'Furniture' || product.category === 'Accessories') && (
                            <div className="size-selection">
                                <h3>
                                    {product.category === 'Furniture' ? 'Select Configuration' :
                                        (product.tags?.some(t => t.toLowerCase().includes('saree')) ? 'Size' : 'Select Size')}
                                </h3>
                                {product.tags?.some(t => t.toLowerCase().includes('saree')) ? (
                                    <div className="size-options">
                                        <button className="size-btn active" style={{ cursor: 'default' }}>Free Size</button>
                                    </div>
                                ) : (
                                    <div className="size-options">
                                        {(product.category === 'Furniture'
                                            ? (product.tags?.some(t => t.toLowerCase().includes('bed')) ? ['Queen', 'King'] : ['Standard', 'Large', 'Compact'])
                                            : (product.tags?.some(t => t.toLowerCase().includes('shoe')) ? ['6', '7', '8', '9', '10'] : ['XS', 'S', 'M', 'L', 'XL', 'XXL'])
                                        ).map(size => (
                                            <button
                                                key={size}
                                                className={`size-btn ${selectedSize === size ? 'active' : ''}`}
                                                onClick={() => setSelectedSize(size)}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <span className="size-chart-link" onClick={() => setShowSizeChart(true)}>
                                    {product.category === 'Furniture' ? 'Dimensions & Details' : 'Size Chart'}
                                </span>
                            </div>
                        )}

                        {/* Quantity */}
                        <div className="quantity-section">
                            <h3>Quantity</h3>
                            <div className="quantity-controls">
                                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                                <span>{quantity}</span>
                                <button onClick={() => setQuantity(quantity + 1)}>+</button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="action-buttons">
                            <button className="premium-btn add-to-cart" onClick={() => {
                                addToCart({ id: product.id, name: product.name, price: numericPrice, image: product.image, size: selectedSize, quantity });
                                setAddedToCart(true);
                                setTimeout(() => setAddedToCart(false), 2000);
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.71a2 2 0 0 0 2-1.61l1.71-8.55H5.41" /></svg>
                                {addedToCart ? '✓ Added!' : 'Add to Cart'}
                            </button>
                            <button className="premium-btn buy-now-btn" onClick={() => {
                                addToCart({ id: product.id, name: product.name, price: numericPrice, image: product.image, size: selectedSize, quantity });
                                navigate('/cart');
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                Buy Now
                            </button>
                            <button
                                className={`wishlist-btn ${isWishlisted(product.id) ? 'wishlisted' : ''}`}
                                onClick={() => toggleWishlist({ id: product.id, name: product.name, price: numericPrice, image: product.image })}
                                title={isWishlisted(product.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill={isWishlisted(product.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Product Details Tabs */}
                <div className="product-info-tabs fade-in">
                    <div className="tab-section glass-effect">
                        <h2>Key Features</h2>
                        <ul className="features-list">
                            {product.features.map((feature, idx) => (
                                <li key={idx}>✓ {feature}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="tab-section glass-effect">
                        <h2>Technical Specifications</h2>
                        <table className="specs-table">
                            <tbody>
                                {Object.entries(product.specifications).map(([key, value]) => (
                                    <tr key={key}>
                                        <td className="spec-label">{key}</td>
                                        <td className="spec-value">{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="tab-section glass-effect">
                        <h2>Customer Reviews & Ratings</h2>
                        <div className="reviews-summary">
                            <div className="rating-overview">
                                <span className="big-rating">{product.rating}</span>
                                <div className="stars-large">
                                    {'★'.repeat(Math.floor(product.rating))}{'☆'.repeat(5 - Math.floor(product.rating))}
                                </div>
                                <p>{product.reviews} verified ratings</p>
                            </div>
                        </div>
                        <div className="review-item">
                            <div className="reviewer-info">
                                <strong>John Doe</strong>
                                <div className="stars">★★★★★</div>
                            </div>
                            <p>Excellent product! The quality is amazing and fits my needs perfectly.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Size Chart Modal */}
            {showSizeChart && (
                <div className="modal-overlay bottom-sheet-overlay fade-in" onClick={() => setShowSizeChart(false)}>
                    <div className="size-chart-modal bottom-sheet slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-handle-bar"></div>
                        <div className="modal-header">
                            <div className="modal-title-container">
                                <h2>{product.name}</h2>
                                <p className="modal-subtitle">Size Chart & Measurement Guide</p>
                            </div>
                            <button className="close-modal" onClick={() => setShowSizeChart(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-section table-wrapper">
                                {product.category.toLowerCase().includes('furniture') ? (
                                    <table className="size-table-premium">
                                        <thead><tr><th>Type</th><th>Length (cm)</th><th>Width (cm)</th><th>Height (cm)</th></tr></thead>
                                        <tbody>
                                            {product.tags?.some(t => t.toLowerCase().includes('bed')) ? (
                                                <><tr><td>Queen</td><td>200</td><td>150</td><td>110</td></tr><tr><td>King</td><td>200</td><td>180</td><td>110</td></tr></>
                                            ) : (
                                                <><tr><td>Compact</td><td>80</td><td>60</td><td>75</td></tr><tr><td>Standard</td><td>120</td><td>80</td><td>75</td></tr><tr><td>Large</td><td>160</td><td>90</td><td>75</td></tr></>
                                            )}
                                        </tbody>
                                    </table>
                                ) : product.tags?.some(t => t.toLowerCase().includes('saree')) ? (
                                    <table className="size-table-premium">
                                        <thead><tr><th>Component</th><th>Length</th><th>Width</th><th>Details</th></tr></thead>
                                        <tbody>
                                            <tr><td>Saree</td><td>5.5 Meters</td><td>1.1 Meters</td><td>Standard Drape</td></tr>
                                            <tr><td>Blouse Piece</td><td>0.8 Meters</td><td>1.1 Meters</td><td>Unstitched Fabric</td></tr>
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="size-table-premium">
                                        <thead><tr><th>Size</th><th>Bust</th><th>Waist</th><th>Hip</th></tr></thead>
                                        <tbody>
                                            <tr><td>XS</td><td>32-34"</td><td>26-28"</td><td>34-36"</td></tr>
                                            <tr><td>S</td><td>34-36"</td><td>28-30"</td><td>36-38"</td></tr>
                                            <tr><td>M</td><td>36-38"</td><td>30-32"</td><td>38-40"</td></tr>
                                            <tr><td>L</td><td>38-40"</td><td>32-34"</td><td>40-42"</td></tr>
                                            <tr><td>XL</td><td>40-42"</td><td>34-36"</td><td>42-44"</td></tr>
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className="modal-footer-info">
                                <p className="size-note">* Standard sizing applies. If you're between sizes, we recommend going one size up.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
};

export default ProductDetail;
