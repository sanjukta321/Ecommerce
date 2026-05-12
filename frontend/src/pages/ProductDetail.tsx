import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { allProducts } from '../data/allProducts';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
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
    images?: string[];
    description?: string;
    has_variants?: number;
    actual_qty?: number;
}

interface VariantItem {
    item_code: string;
    price: number;
    image?: string;
    images?: string[];
    [attr: string]: any;
}

interface VariantData {
    attributes: { attribute: string; values: string[] }[];
    variants: VariantItem[];
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
    actual_qty?: number;
}

const PLACEHOLDER = 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&q=80&w=1000';

const COLOUR_MAP: Record<string, string> = {
    red: '#e53e3e', blue: '#3182ce', green: '#38a169', black: '#1a202c',
    white: '#ffffff', yellow: '#d69e2e', pink: '#d53f8c', purple: '#805ad5',
    orange: '#dd6b20', brown: '#744210', grey: '#718096', gray: '#718096',
    navy: '#1a365d', maroon: '#702459', teal: '#2c7a7b', cyan: '#0987a0',
    beige: '#d4b896', cream: '#fffdd0', khaki: '#c3b091', olive: '#6b7c3b',
};

function cssColour(name: string): string {
    return COLOUR_MAP[name.toLowerCase()] ?? name.toLowerCase();
}

function buildDisplayFromFrappe(item: FrappeItem): DisplayProduct {
    const rate = item.selling_price || item.standard_rate || 0;
    const price = `₹${rate.toLocaleString('en-IN')}`;
    const originalPrice = `₹${Math.round(rate * 1.2).toLocaleString('en-IN')}`;
    const img = item.image
        ? (item.image.startsWith('http') ? item.image : BASE + item.image)
        : PLACEHOLDER;

    const galleryImgs = item.images?.length
        ? item.images
        : [img];

    return {
        id: item.name,
        name: item.item_name || item.name,
        price,
        originalPrice,
        image: img,
        images: galleryImgs,
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
        actual_qty: item.actual_qty,
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
        images: [p.image],
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
    const { showToast } = useToast();
    const [selectedSize, setSelectedSize] = useState('M');
    const [quantity, setQuantity] = useState(1);
    const [activeImage, setActiveImage] = useState(0);
    const [showSizeChart, setShowSizeChart] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false);
    const [showLightbox, setShowLightbox] = useState(false);
    const [isHoveringGallery, setIsHoveringGallery] = useState(false);

    const [product, setProduct] = useState<DisplayProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [stockAlertSubscribed, setStockAlertSubscribed] = useState(false);
    const [stockAlertLoading, setStockAlertLoading] = useState(false);
    const [stockAlertMsg, setStockAlertMsg] = useState('');

    interface ReviewEntry { name: string; reviewer: string; rating: number; review_title: string; comment: string; creation: string; }
    const [itemReviews, setItemReviews] = useState<ReviewEntry[]>([]);
    const [avgRating, setAvgRating] = useState(0);
    const [reviewCount, setReviewCount] = useState(0);

    // Variant state
    const [isTemplate, setIsTemplate] = useState(false);
    const [variantData, setVariantData] = useState<VariantData | null>(null);
    const [selectedColour, setSelectedColour] = useState('');
    const [selectedVariantSize, setSelectedVariantSize] = useState('');

    const csrfToken = () =>
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || 'fetch';

    useEffect(() => {
        window.scrollTo(0, 0);
        setLoading(true);
        setActiveImage(0);
        setIsTemplate(false);
        setVariantData(null);
        setSelectedColour('');
        setSelectedVariantSize('');

        if (!id) {
            setLoading(false);
            return;
        }

        fetch(
            `${BASE}/api/method/store_customizations.api.products.get_product?item_code=${encodeURIComponent(id)}`,
            { credentials: 'include', headers: { 'X-Frappe-CSRF-Token': csrfToken() } }
        )
            .then(r => r.json())
            .then(async data => {
                const item: FrappeItem | undefined = data.message;
                if (item && item.name) {
                    setProduct(buildDisplayFromFrappe(item));
                    if (item.has_variants) {
                        setIsTemplate(true);
                        try {
                            const vRes = await fetch(
                                `${BASE}/api/method/store_customizations.api.products.get_item_variants?item_code=${encodeURIComponent(item.name)}`,
                                { credentials: 'include', headers: { 'X-Frappe-CSRF-Token': csrfToken() } }
                            );
                            const vJson = await vRes.json();
                            if (vJson.message) setVariantData(vJson.message);
                        } catch {}
                    }
                } else {
                    throw new Error('not found in backend');
                }
            })
            .catch(() => {
                const staticItem = allProducts.find(p => p.id === id);
                setProduct(staticItem ? buildDisplayFromStatic(staticItem) : null);
            })
            .finally(() => setLoading(false));

        // Fetch real reviews for this item
        fetch(
            `${BASE}/api/method/store_customizations.api.reviews.get_item_reviews?item_code=${encodeURIComponent(id)}`,
            { credentials: 'include', headers: { 'X-Frappe-CSRF-Token': csrfToken() } }
        )
            .then(r => r.json())
            .then(data => {
                if (data.message) {
                    setItemReviews(data.message.reviews || []);
                    setAvgRating(data.message.avg_rating || 0);
                    setReviewCount(data.message.count || 0);
                }
            })
            .catch(() => {});

        // Fetch stock alert subscription status
        fetch(
            `${BASE}/api/method/store_customizations.api.notifications.get_stock_alert_status?item_code=${encodeURIComponent(id)}`,
            { credentials: 'include', headers: { 'X-Frappe-CSRF-Token': csrfToken() } }
        )
            .then(r => r.json())
            .then(d => setStockAlertSubscribed(d.message?.subscribed || false))
            .catch(() => {});
    }, [id]);

    const handleStockAlert = async (itemCode: string) => {
        setStockAlertLoading(true);
        setStockAlertMsg('');
        const endpoint = stockAlertSubscribed ? 'unsubscribe_stock_alert' : 'subscribe_stock_alert';
        try {
            const res = await fetch(`${BASE}/api/method/store_customizations.api.notifications.${endpoint}`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Frappe-CSRF-Token': csrfToken() },
                body: new URLSearchParams({ item_code: itemCode }).toString(),
            });
            const data = await res.json();
            if (data.message?.subscribed !== undefined || data.message?.unsubscribed) {
                setStockAlertSubscribed(!stockAlertSubscribed);
                setStockAlertMsg(stockAlertSubscribed ? 'Alert removed.' : "We'll notify you when this item is back!");
            } else if (data.exc_type === 'PermissionError') {
                setStockAlertMsg('Please log in to set stock alerts.');
            }
        } catch {
            setStockAlertMsg('Something went wrong.');
        } finally {
            setStockAlertLoading(false);
        }
    };

    // Derive active variant
    // Detect actual attribute names from Frappe (avoids hardcoding 'Colour'/'Size')
    const colourAttrName = variantData?.attributes.find(
        a => /colou?r/i.test(a.attribute)
    )?.attribute ?? variantData?.attributes[0]?.attribute ?? 'Colour';

    const sizeAttrName = variantData?.attributes.find(
        a => /size/i.test(a.attribute)
    )?.attribute ?? variantData?.attributes[1]?.attribute ?? 'Size';

    const activeVariant: VariantItem | null = isTemplate && variantData
        ? (variantData.variants.find(
            v => v[colourAttrName] === selectedColour && v[sizeAttrName] === selectedVariantSize
          ) ?? null)
        : null;

    // Sizes available for the selected colour
    const availableSizes: string[] = isTemplate && variantData && selectedColour
        ? variantData.variants
            .filter(v => v[colourAttrName] === selectedColour)
            .map(v => v[sizeAttrName])
            .filter(Boolean)
        : (variantData?.attributes.find(a => a.attribute === sizeAttrName)?.values ?? []);

    const colours: string[] = variantData?.attributes.find(a => a.attribute === colourAttrName)?.values ?? [];

    // Resolved display image and price
    const displayImage = (() => {
        if (activeVariant?.image) {
            const img = activeVariant.image;
            return img.startsWith('http') ? img : BASE + img;
        }
        return product?.image ?? PLACEHOLDER;
    })();

    const galleryImages = useMemo(() => {
        if (activeVariant?.images?.length) return activeVariant.images;
        if (selectedColour && variantData) {
            const imgs = variantData.variants
                .filter(v => v[colourAttrName] === selectedColour)
                .flatMap(v => v.images?.length ? v.images : (v.image ? [v.image] : []));
            const unique = [...new Set(imgs)];
            if (unique.length) return unique;
        }
        return product?.images ?? [];
    }, [activeVariant, selectedColour, variantData, product, colourAttrName]);

    useEffect(() => { setActiveImage(0); }, [galleryImages]);

    useEffect(() => {
        if (galleryImages.length <= 1 || isHoveringGallery) return;
        const timer = setInterval(() => {
            setActiveImage(i => (i + 1) % galleryImages.length);
        }, 3500);
        return () => clearInterval(timer);
    }, [galleryImages, isHoveringGallery]);

    const displayPrice = activeVariant
        ? `₹${Number(activeVariant.price).toLocaleString('en-IN')}`
        : product?.price ?? '';

    const numericPrice = parseInt(displayPrice.replace(/[^\d]/g, ''), 10) || 0;
    const cartItemId = activeVariant ? activeVariant.item_code : (product?.id ?? '');

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

    const canAddToCart = !isTemplate || activeVariant !== null;

    return (
        <div className="product-detail-page">
            <div className="detail-container container">
                <div className="product-detail-grid fade-in">
                    {/* Image Gallery */}
                    <div className="image-gallery"
                        onMouseEnter={() => setIsHoveringGallery(true)}
                        onMouseLeave={() => setIsHoveringGallery(false)}>
                        <div className="main-image" onClick={() => setShowLightbox(true)}>
                            <img key={activeImage} src={galleryImages[activeImage] ?? displayImage} alt={product.name} />
                            {galleryImages.length > 1 && (
                                <>
                                    <button className="gallery-arrow gallery-prev"
                                        onClick={e => { e.stopPropagation(); setActiveImage(i => (i - 1 + galleryImages.length) % galleryImages.length); }}>
                                        ‹
                                    </button>
                                    <button className="gallery-arrow gallery-next"
                                        onClick={e => { e.stopPropagation(); setActiveImage(i => (i + 1) % galleryImages.length); }}>
                                        ›
                                    </button>
                                </>
                            )}
                        </div>
                        {galleryImages.length > 1 && (
                            <div className="slide-dots">
                                {galleryImages.map((_, idx) => (
                                    <button key={idx}
                                        className={`slide-dot${activeImage === idx ? ' active' : ''}`}
                                        onClick={() => setActiveImage(idx)} />
                                ))}
                            </div>
                        )}
                        {galleryImages.length > 1 && (
                            <div className="thumbnail-strip">
                                {galleryImages.map((img, idx) => (
                                    <img
                                        key={idx}
                                        src={img}
                                        alt={`View ${idx + 1}`}
                                        className={activeImage === idx ? 'active' : ''}
                                        onClick={() => setActiveImage(idx)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Lightbox */}
                    {showLightbox && (
                        <div className="lightbox-overlay" onClick={() => setShowLightbox(false)}>
                            <div className="lightbox-grid" onClick={e => e.stopPropagation()}>
                                <button className="lightbox-close" onClick={() => setShowLightbox(false)}>✕</button>
                                {galleryImages.map((img, idx) => (
                                    <div key={idx} className={`lightbox-card${activeImage === idx ? ' active' : ''}`}
                                        onClick={() => { setActiveImage(idx); setShowLightbox(false); }}>
                                        <img src={img} alt={`View ${idx + 1}`} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Product Info */}
                    <div className="product-details">
                        <h1>{product.name}</h1>

                        <p className="product-short-description">{product.description}</p>

                        <div className="rating-section">
                            <div className="stars">
                                {reviewCount > 0
                                    ? ('★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating)))
                                    : '☆☆☆☆☆'}
                            </div>
                            <span className="rating-text">
                                {reviewCount > 0 ? `${avgRating.toFixed(1)} (${reviewCount} review${reviewCount > 1 ? 's' : ''})` : 'No reviews yet'}
                            </span>
                        </div>

                        <div className="price-section">
                            <span className="current-price">{displayPrice}</span>
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

                        {/* Variant Selector (template items) */}
                        {isTemplate && variantData && (
                            <div className="variant-selector">
                                {colours.length > 0 && (
                                    <div className="variant-attribute">
                                        <h3>
                                            Colour{selectedColour ? `: ${selectedColour}` : ''}
                                        </h3>
                                        <div className="colour-swatches">
                                            {colours.map(colour => (
                                                <button
                                                    key={colour}
                                                    className={`colour-swatch ${selectedColour === colour ? 'active' : ''}`}
                                                    style={{ background: cssColour(colour) }}
                                                    title={colour}
                                                    onClick={() => {
                                                        setSelectedColour(colour);
                                                        setSelectedVariantSize('');
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {availableSizes.length > 0 && (
                                    <div className="variant-attribute">
                                        <h3>Size</h3>
                                        <div className="size-options">
                                            {availableSizes.map(size => (
                                                <button
                                                    key={size}
                                                    className={`size-btn ${selectedVariantSize === size ? 'active' : ''}`}
                                                    onClick={() => setSelectedVariantSize(size)}
                                                >
                                                    {size}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {isTemplate && !activeVariant && (selectedColour || selectedVariantSize) && (
                                    <p className="variant-hint">
                                        {!selectedColour
                                            ? 'Please select a colour'
                                            : 'Please select a size'}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Static Size Selection (non-template Frappe / static items) */}
                        {!isTemplate && (product.category === 'Fashion' || product.category === 'Furniture' || product.category === 'Accessories') && (
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
                            {(product.actual_qty ?? 1) <= 0 ? (
                                <div className="stock-alert-section">
                                    <p className="out-of-stock-label">Out of Stock</p>
                                    <button
                                        className={`notify-me-btn ${stockAlertSubscribed ? 'subscribed' : ''}`}
                                        disabled={stockAlertLoading}
                                        onClick={() => handleStockAlert(product.id)}
                                    >
                                        {stockAlertLoading
                                            ? 'Please wait…'
                                            : stockAlertSubscribed
                                                ? 'Notifying You'
                                                : 'Notify Me When Available'}
                                    </button>
                                    {stockAlertMsg && <p className="stock-alert-msg">{stockAlertMsg}</p>}
                                </div>
                            ) : (
                                <>
                                    <button
                                        className="premium-btn add-to-cart"
                                        disabled={!canAddToCart}
                                        style={!canAddToCart ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        onClick={() => {
                                            if (!canAddToCart) return;
                                            addToCart({
                                                id: cartItemId,
                                                name: activeVariant
                                                    ? `${product.name} (${selectedColour}, ${selectedVariantSize})`
                                                    : product.name,
                                                price: numericPrice,
                                                image: displayImage,
                                                size: isTemplate ? selectedVariantSize : selectedSize,
                                                quantity,
                                            });
                                            showToast(`${product.name} added to cart!`, 'success');
                                            setAddedToCart(true);
                                            setTimeout(() => setAddedToCart(false), 2000);
                                        }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.71a2 2 0 0 0 2-1.61l1.71-8.55H5.41" /></svg>
                                        {addedToCart ? '✓ Added!' : 'Add to Cart'}
                                    </button>
                                    <button
                                        className="premium-btn buy-now-btn"
                                        disabled={!canAddToCart}
                                        style={!canAddToCart ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        onClick={() => {
                                            if (!canAddToCart) return;
                                            addToCart({
                                                id: cartItemId,
                                                name: activeVariant
                                                    ? `${product.name} (${selectedColour}, ${selectedVariantSize})`
                                                    : product.name,
                                                price: numericPrice,
                                                image: displayImage,
                                                size: isTemplate ? selectedVariantSize : selectedSize,
                                                quantity,
                                            });
                                            navigate('/cart');
                                        }}
                                    >
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
                                </>
                            )}
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
                                <span className="big-rating">{reviewCount > 0 ? avgRating.toFixed(1) : '—'}</span>
                                <div className="stars-large">
                                    {reviewCount > 0
                                        ? ('★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating)))
                                        : '☆☆☆☆☆'}
                                </div>
                                <p>{reviewCount > 0 ? `${reviewCount} verified rating${reviewCount > 1 ? 's' : ''}` : 'No ratings yet'}</p>
                            </div>
                        </div>
                        {itemReviews.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', padding: '12px 0' }}>
                                No reviews yet. Be the first to review this product!
                            </p>
                        ) : (
                            itemReviews.map(r => (
                                <div key={r.name} className="review-item">
                                    <div className="reviewer-info">
                                        <strong>{r.reviewer}</strong>
                                        <div className="stars">
                                            {'★'.repeat(Math.round(r.rating))}{'☆'.repeat(5 - Math.round(r.rating))}
                                        </div>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 8 }}>{r.creation}</span>
                                    </div>
                                    {r.review_title && <strong style={{ display: 'block', marginBottom: 4 }}>{r.review_title}</strong>}
                                    <p>{r.comment}</p>
                                </div>
                            ))
                        )}
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
