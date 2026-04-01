import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { allProducts } from '../data/allProducts';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import Footer from '../components/Footer';
import '../styles/ProductDetail.css';

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

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    const productData = allProducts.find(p => p.id === id);

    if (!productData) {
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

    // Prepare display data with fallbacks for missing detailed fields
    const productDisplay = {
        ...productData,
        originalPrice: (parseInt(productData.price.replace(/[^\d]/g, '')) * 1.2).toLocaleString('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }),
        reviews: 456 + (productData.name.length * 10), // Deterministic mock reviews
        images: [
            productData.image,
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000',
            'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&q=80&w=1000'
        ],
        description: `Premium ${productData.name} from our ${productData.category} collection. Designed for those who appreciate quality and style. This product offers exceptional value and performance.`,
        features: [
            'Premium Build Quality',
            'Sleek and Modern Design',
            '1-Year Brand Warranty',
            'High Performance Materials',
            'Best-in-class features'
        ],
        specifications: {
            'Category': productData.category,
            'Model': productData.name,
            'Warranty': '1 Year',
            'Material': 'Premium Grade',
            'Availability': 'In Stock'
        }
    };


    return (
        <div className="product-detail-page">
            <div className="detail-container container">
                <div className="product-detail-grid fade-in">
                    {/* Image Gallery */}
                    <div className="image-gallery">
                        <div className="main-image">
                            <img src={productDisplay.images[activeImage]} alt={productDisplay.name} />
                        </div>
                        <div className="thumbnail-strip">
                            {productDisplay.images.map((img, idx) => (
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
                        <h1>{productDisplay.name}</h1>

                        <p className="product-short-description">{productDisplay.description}</p>

                        <div className="rating-section">
                            <div className="stars">
                                {'★'.repeat(Math.floor(productDisplay.rating))}{'☆'.repeat(5 - Math.floor(productDisplay.rating))}
                            </div>
                            <span className="rating-text">{productDisplay.rating} ({productDisplay.reviews} reviews)</span>
                        </div>

                        <div className="price-section">
                            <span className="current-price">{productDisplay.price}</span>
                            <span className="original-price">{productDisplay.originalPrice}</span>
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

                        {/* Dynamic Size Selection */}
                        {(productData.category === 'Fashion' || productData.category === 'Furniture' || productData.category === 'Accessories') && (
                            <div className="size-selection">
                                <h3>
                                    {productData.category === 'Furniture' ? 'Select Configuration' :
                                        (productDisplay.tags?.some(t => t.toLowerCase().includes('saree')) ? 'Size' : 'Select Size')}
                                </h3>

                                {productDisplay.tags?.some(t => t.toLowerCase().includes('saree')) ? (
                                    <div className="size-options">
                                        <button className="size-btn active" style={{ cursor: 'default' }}>Free Size</button>
                                    </div>
                                ) : (
                                    <div className="size-options">
                                        {(productData.category === 'Furniture' ?
                                            (productData.tags?.some(t => t.toLowerCase().includes('bed')) ? ['Queen', 'King'] : ['Standard', 'Large', 'Compact']) :
                                            (productData.tags?.some(t => t.toLowerCase().includes('shoe')) ? ['6', '7', '8', '9', '10'] : ['XS', 'S', 'M', 'L', 'XL', 'XXL'])
                                        ).map((size) => (
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
                                    {productData.category === 'Furniture' ? 'Dimensions & Details' : 'Size Chart'}
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
                                const numericPrice = parseInt(productData.price.replace(/[^\d]/g, ''), 10);
                                addToCart({ id: productData.id, name: productData.name, price: numericPrice, image: productData.image, size: selectedSize, quantity });
                                setAddedToCart(true);
                                setTimeout(() => setAddedToCart(false), 2000);
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.71a2 2 0 0 0 2-1.61l1.71-8.55H5.41" /></svg>
                                {addedToCart ? '✓ Added!' : 'Add to Cart'}
                            </button>
                            <button className="premium-btn buy-now-btn" onClick={() => {
                                const numericPrice = parseInt(productData.price.replace(/[^\d]/g, ''), 10);
                                addToCart({ id: productData.id, name: productData.name, price: numericPrice, image: productData.image, size: selectedSize, quantity });
                                navigate('/cart');
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                                Buy Now
                            </button>
                            <button
                                className={`wishlist-btn ${productData && isWishlisted(productData.id) ? 'wishlisted' : ''}`}
                                onClick={() => productData && toggleWishlist({ id: productData.id, name: productData.name, price: parseInt(productData.price.replace(/[^\d]/g,''),10), image: productData.image })}
                                title={productData && isWishlisted(productData.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill={productData && isWishlisted(productData.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Product Details Tabs */}
                <div className="product-info-tabs fade-in">
                    <div className="tab-section glass-effect">
                        <h2>Key Features</h2>
                        <ul className="features-list">
                            {productDisplay.features.map((feature, idx) => (
                                <li key={idx}>✓ {feature}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="tab-section glass-effect">
                        <h2>Technical Specifications</h2>
                        <table className="specs-table">
                            <tbody>
                                {Object.entries(productDisplay.specifications).map(([key, value]) => (
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
                                <span className="big-rating">{productDisplay.rating}</span>
                                <div className="stars-large">
                                    {'★'.repeat(Math.floor(productDisplay.rating))}{'☆'.repeat(5 - Math.floor(productDisplay.rating))}
                                </div>
                                <p>{productDisplay.reviews} verified ratings</p>
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

            {/* Bottom-Sheet Size Chart Modal (Triggered by Size Chart Link) */}
            {showSizeChart && (
                <div className="modal-overlay bottom-sheet-overlay fade-in" onClick={() => setShowSizeChart(false)}>
                    <div className="size-chart-modal bottom-sheet slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-handle-bar"></div>
                        <div className="modal-header">
                            <div className="modal-title-container">
                                <h2>{productDisplay.name}</h2>
                                <p className="modal-subtitle">Size Chart & Measurement Guide</p>
                            </div>
                            <button className="close-modal" onClick={() => setShowSizeChart(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            {/* Size Table Section */}
                            <div className="modal-section table-wrapper">
                                {productDisplay.category.toLowerCase().includes('furniture') ? (
                                    <table className="size-table-premium">
                                        <thead>
                                            <tr>
                                                <th>Type</th>
                                                <th>Length (cm)</th>
                                                <th>Width (cm)</th>
                                                <th>Height (cm)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {productDisplay.tags?.some(t => t.toLowerCase().includes('bed')) ? (
                                                <>
                                                    <tr><td>Queen</td><td>200</td><td>150</td><td>110</td></tr>
                                                    <tr><td>King</td><td>200</td><td>180</td><td>110</td></tr>
                                                </>
                                            ) : productDisplay.tags?.some(t => t.toLowerCase().includes('sofa')) ? (
                                                <>
                                                    <tr><td>Compact</td><td>160</td><td>90</td><td>85</td></tr>
                                                    <tr><td>Standard</td><td>210</td><td>95</td><td>85</td></tr>
                                                    <tr><td>Large</td><td>240</td><td>100</td><td>85</td></tr>
                                                </>
                                            ) : (
                                                <>
                                                    <tr><td>Compact</td><td>80</td><td>60</td><td>75</td></tr>
                                                    <tr><td>Standard</td><td>120</td><td>80</td><td>75</td></tr>
                                                    <tr><td>Large</td><td>160</td><td>90</td><td>75</td></tr>
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                ) : productDisplay.tags?.some(t => t.toLowerCase().includes('saree')) ? (
                                    <table className="size-table-premium">
                                        <thead>
                                            <tr>
                                                <th>Component</th>
                                                <th>Length</th>
                                                <th>Width</th>
                                                <th>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>Saree</td>
                                                <td>5.5 Meters</td>
                                                <td>1.1 Meters</td>
                                                <td>Standard Drape</td>
                                            </tr>
                                            <tr>
                                                <td>Blouse Piece</td>
                                                <td>0.8 Meters</td>
                                                <td>1.1 Meters</td>
                                                <td>Unstitched Fabric</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                ) : productDisplay.tags?.some(t => t.toLowerCase().includes('shoe')) || productDisplay.category.toLowerCase().includes('footwear') ? (
                                    <table className="size-table-premium">
                                        <thead>
                                            <tr>
                                                <th>UK/India</th>
                                                <th>Length (in cm)</th>
                                                <th>Brand Size</th>
                                                <th>Euro</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td>5</td><td>22.2</td><td>5</td><td>38</td></tr>
                                            <tr><td>6</td><td>22.9</td><td>6</td><td>39</td></tr>
                                            <tr><td>7</td><td>24.1</td><td>7</td><td>40</td></tr>
                                            <tr><td>8</td><td>24.8</td><td>8</td><td>41</td></tr>
                                            <tr><td>9</td><td>25.4</td><td>9</td><td>42</td></tr>
                                        </tbody>
                                    </table>
                                ) : productDisplay.tags?.some(t => t.toLowerCase().includes('jeans')) ? (
                                    <table className="size-table-premium">
                                        <thead>
                                            <tr><th>Waist</th><th>Hip</th><th>Length</th></tr>
                                        </thead>
                                        <tbody>
                                            <tr><td>28"</td><td>34"</td><td>30"</td></tr>
                                            <tr><td>30"</td><td>36"</td><td>32"</td></tr>
                                            <tr><td>32"</td><td>38"</td><td>32"</td></tr>
                                            <tr><td>34"</td><td>40"</td><td>34"</td></tr>
                                            <tr><td>36"</td><td>42"</td><td>34"</td></tr>
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="size-table-premium">
                                        <thead>
                                            <tr><th>Size</th><th>Bust</th><th>Waist</th><th>Hip</th></tr>
                                        </thead>
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

                            {/* Measurement Guidelines Section */}
                            {(productDisplay.tags?.some(t => t.toLowerCase().includes('shoe')) || productDisplay.category.toLowerCase().includes('footwear')) ? (
                                <div className="modal-section measurement-guide-new">
                                    <h3 className="section-title">Measurement Guidelines:</h3>
                                    <p className="guide-intro">Not sure about your shoe size? Follow these simple steps to figure it out:</p>
                                    <div className="guide-content-modern">
                                        <div className="guide-steps-list-new">
                                            <p><strong>1.</strong> Place your foot on a blank sheet of paper</p>
                                            <p><strong>2.</strong> Make one marking at your longest toe and one marking at the backside of your heel</p>
                                            <p><strong>3.</strong> Measure (in centimetres) the length of your foot between these two markings</p>
                                            <p><strong>4.</strong> Compare the value to our measurement chart to know your shoe size</p>
                                        </div>
                                    </div>
                                </div>
                            ) : productDisplay.category.toLowerCase().includes('furniture') && (
                                <div className="modal-section measurement-guide-new">
                                    <h3 className="section-title">Space Guidelines:</h3>
                                    <p className="guide-intro">To ensure a perfect fit in your home:</p>
                                    <div className="guide-content-modern">
                                        <div className="guide-steps-list-new">
                                            <p><strong>1.</strong> Measure the floor space where you plan to place the furniture.</p>
                                            <p><strong>2.</strong> Check doorway and hallway widths to ensure smooth delivery.</p>
                                            <p><strong>3.</strong> Allow for at least 60cm of walking space around the piece.</p>
                                            <p><strong>4.</strong> Compare dimensions with your room's layout before ordering.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

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
