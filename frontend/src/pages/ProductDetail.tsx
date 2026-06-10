import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { allProducts } from '../data/allProducts';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import Footer from '../components/Footer';
import ShareModal from '../components/ShareModal';
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
    const { addToCart, cart } = useCart();
    const { toggleWishlist, isWishlisted } = useWishlist();
    const { showToast } = useToast();
    const [quantity, setQuantity] = useState(1);
    const [activeImage, setActiveImage] = useState(0);
    const [showSizeChart, setShowSizeChart] = useState(false);
    const [addedToCart, setAddedToCart] = useState(false); // kept for toast timing only
    const [showLightbox, setShowLightbox] = useState(false);
    const [isHoveringGallery, setIsHoveringGallery] = useState(false);

    const [product, setProduct] = useState<DisplayProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [stockAlertSubscribed, setStockAlertSubscribed] = useState(false);
    const [stockAlertLoading, setStockAlertLoading] = useState(false);
    const [stockAlertMsg, setStockAlertMsg] = useState('');

    interface ReviewEntry { name: string; reviewer: string; rating: number; review_title: string; comment: string; creation: string; images?: string[]; }
    const [itemReviews, setItemReviews] = useState<ReviewEntry[]>([]);
    const [avgRating, setAvgRating] = useState(0);
    const [reviewCount, setReviewCount] = useState(0);

    // Variant state
    const [shareModal, setShareModal] = useState<{ url: string; title: string; text: string } | null>(null);

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

    useEffect(() => {
        if (galleryImages.length <= 1) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft')
                setActiveImage(i => (i - 1 + galleryImages.length) % galleryImages.length);
            else if (e.key === 'ArrowRight')
                setActiveImage(i => (i + 1) % galleryImages.length);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [galleryImages]);

    const displayPrice = activeVariant
        ? `₹${Number(activeVariant.price).toLocaleString('en-IN')}`
        : product?.price ?? '';

    const numericPrice = parseInt(displayPrice.replace(/[^\d]/g, ''), 10) || 0;
    const cartItemId = activeVariant ? activeVariant.item_code : (product?.id ?? '');
    const cartItemSize = isTemplate ? (selectedVariantSize || 'Default') : 'Default';

    // All variants of this template in cart — used only for the info banner
    const totalVariantsInCart = !product || !isTemplate ? 0
        : cart.filter(i => i.id === product.id || i.id.startsWith(product.id + '-')).reduce((s, i) => s + i.quantity, 0);

    // Qty of the CURRENTLY SELECTED variant/product — drives button state (Go to Cart vs Add to Cart)
    // Template with no variant selected = 0 so the button stays "Select Options", not "Go to Cart"
    const cartQtyForItem = !product ? 0 : isTemplate
        ? (activeVariant
            ? cart.filter(i => i.id === activeVariant.item_code && i.size === cartItemSize).reduce((s, i) => s + i.quantity, 0)
            : 0)
        : cart.filter(i => i.id === product.id).reduce((s, i) => s + i.quantity, 0);

    if (loading) {
        return (
            <div className="product-detail-page">
                <div className="detail-container container">
                    <div className="product-skeleton">
                        <div className="skeleton-image" />
                        <div className="skeleton-info">
                            <div className="skeleton-line skeleton-title" />
                            <div className="skeleton-line skeleton-subtitle" />
                            <div className="skeleton-line skeleton-price" />
                            <div className="skeleton-line skeleton-short" />
                            <div className="skeleton-line skeleton-short" />
                        </div>
                    </div>
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
                            {/* Wishlist + Share overlay on image */}
                            <div className="gallery-overlay-actions" onClick={e => e.stopPropagation()}>
                                <button
                                    className={`gallery-action-btn${isWishlisted(product.id) ? ' wishlisted' : ''}`}
                                    onClick={() => toggleWishlist({ id: product.id, name: product.name, price: numericPrice, image: product.image })}
                                    title={isWishlisted(product.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill={isWishlisted(product.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                </button>
                                <button
                                    className="gallery-action-btn"
                                    onClick={() => setShareModal({
                                        url: `${window.location.origin}/product/${product.id}`,
                                        title: product.name,
                                        text: `Check out ${product.name}`,
                                    })}
                                    title="Share this product"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                                </button>
                            </div>
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
                            <div className="stars" aria-label={reviewCount > 0 ? `${avgRating.toFixed(1)} out of 5 stars` : 'No ratings yet'} role="img">
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
                                <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{verticalAlign:'middle',marginRight:6}}><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>10% instant discount on HDFC Bank cards</li>
                                <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{verticalAlign:'middle',marginRight:6}}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>No cost EMI available on orders above ₹3000</li>
                                <li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{verticalAlign:'middle',marginRight:6}}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>Free delivery on orders above ₹500</li>
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
                                    {/* This exact variant is already in cart */}
                                    {cartQtyForItem > 0 && (
                                        <div className="in-cart-info">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                            <span><strong>{cartQtyForItem}</strong> of this variant in your cart</span>
                                            <button className="in-cart-view-btn" onClick={() => navigate('/cart')}>View Cart →</button>
                                        </div>
                                    )}
                                    {/* Other variants are in cart but not the currently selected one */}
                                    {cartQtyForItem === 0 && totalVariantsInCart > 0 && (
                                        <div className="in-cart-info in-cart-info--other">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                            <span><strong>{totalVariantsInCart}</strong> other variant{totalVariantsInCart > 1 ? 's' : ''} of this product in cart</span>
                                            <button className="in-cart-view-btn" onClick={() => navigate('/cart')}>View Cart →</button>
                                        </div>
                                    )}
                                    <button
                                        className={`premium-btn add-to-cart${cartQtyForItem > 0 ? ' go-to-cart-active' : ''}`}
                                        disabled={!canAddToCart}
                                        style={!canAddToCart ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        onClick={() => {
                                            if (!canAddToCart) return;
                                            if (cartQtyForItem > 0) {
                                                navigate('/cart');
                                                return;
                                            }
                                            addToCart({
                                                id: cartItemId,
                                                name: activeVariant
                                                    ? `${product.name} (${selectedColour}, ${selectedVariantSize})`
                                                    : product.name,
                                                price: numericPrice,
                                                image: displayImage,
                                                size: cartItemSize,
                                                quantity,
                                            });
                                            showToast(`${product.name} added to cart!`, 'success');
                                            setAddedToCart(true);
                                            setTimeout(() => setAddedToCart(false), 1500);
                                        }}
                                    >
                                        {cartQtyForItem > 0
                                            ? <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.71a2 2 0 0 0 2-1.61l1.71-8.55H5.41" /></svg>Go to Cart</>
                                            : <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.71a2 2 0 0 0 2-1.61l1.71-8.55H5.41" /></svg>{addedToCart ? '✓ Added!' : 'Add to Cart'}</>
                                        }
                                    </button>
                                    <button
                                        className="premium-btn buy-now-btn"
                                        disabled={!canAddToCart}
                                        style={!canAddToCart ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        onClick={() => {
                                            if (!canAddToCart) return;
                                            navigate('/checkout', {
                                                state: {
                                                    buyNow: {
                                                        id: cartItemId,
                                                        name: activeVariant
                                                            ? `${product.name} (${selectedColour}, ${selectedVariantSize})`
                                                            : product.name,
                                                        price: numericPrice,
                                                        image: displayImage,
                                                        size: cartItemSize,
                                                        quantity,
                                                    }
                                                }
                                            });
                                        }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                        Buy Now
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
                                    {r.images && r.images.length > 0 && (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                                            {r.images.map((url, i) => (
                                                <a key={i} href={`${BASE}${url}`} target="_blank" rel="noreferrer">
                                                    <img
                                                        src={`${BASE}${url}`}
                                                        alt={`review photo ${i + 1}`}
                                                        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                                                    />
                                                </a>
                                            ))}
                                        </div>
                                    )}
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
                                            <tr><td>Extra Small</td><td>32-34"</td><td>26-28"</td><td>34-36"</td></tr>
                                            <tr><td>Small</td><td>34-36"</td><td>28-30"</td><td>36-38"</td></tr>
                                            <tr><td>Medium</td><td>36-38"</td><td>30-32"</td><td>38-40"</td></tr>
                                            <tr><td>Large</td><td>38-40"</td><td>32-34"</td><td>40-42"</td></tr>
                                            <tr><td>Extra Large</td><td>40-42"</td><td>34-36"</td><td>42-44"</td></tr>
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

            {shareModal && (
                <ShareModal
                    url={shareModal.url}
                    title={shareModal.title}
                    text={shareModal.text}
                    onClose={() => setShareModal(null)}
                />
            )}

            <Footer />
        </div>
    );
};

export default ProductDetail;
