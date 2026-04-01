import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/TrendingNow.css';

const products = [
    { id: '1', name: 'Minimalist Smart Watch', price: '₹12,499', numericPrice: 12499, image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600' },
    { id: '2', name: 'Premium Noise Cancelling Headphones', price: '₹24,999', numericPrice: 24999, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600' },
    { id: '3', name: 'Designer Leather Handbag', price: '₹34,500', numericPrice: 34500, image: 'https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&q=80&w=600' },
    { id: '4', name: 'Elite Performance Footwear', price: '₹14,900', numericPrice: 14900, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600' }
];

const TrendingNow: React.FC = () => {
    const navigate = useNavigate();
    const { addToCart } = useCart();

    return (
        <section className="trending-now container fade-in">
            <div className="section-header">
                <h2>Trending <span>Now</span></h2>
                <span
                    className="view-all"
                    onClick={() => navigate('/new-arrivals')}
                    style={{ cursor: 'pointer' }}
                >
                    View All
                </span>
            </div>
            <div className="product-grid">
                {products.map((product) => (
                    <div
                        key={product.id}
                        className="product-card glass-effect"
                        onClick={() => navigate(`/product/${product.id}`)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="product-image">
                            <img src={product.image} alt={product.name} />
                        </div>
                        <div className="product-info">
                            <div className="product-info-header">
                                <h3>{product.name}</h3>
                                <p className="price">{product.price}</p>
                            </div>
                            <div className="trending-actions">
                                <button
                                    className="action-btn view-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/product/${product.id}`);
                                    }}
                                >
                                    VIEW DETAILS
                                </button>
                                <button
                                    className="action-btn cart-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        addToCart({ id: product.id, name: product.name, price: product.numericPrice, image: product.image, size: 'Default', quantity: 1 });
                                    }}
                                >
                                    ADD TO CART
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default TrendingNow;


