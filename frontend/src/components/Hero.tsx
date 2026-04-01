import { useNavigate } from 'react-router-dom';
import '../styles/Hero.css';

const Hero: React.FC = () => {
    const navigate = useNavigate();

    return (
        <section className="hero editorial-hero fade-in">
            <div className="container hero-content">
                <div className="hero-text">
                    <span className="editorial-badge">Exclusive Release 2026</span>
                    <h1 className="editorial-title">
                        The Art of <span>Living</span> <br />
                        High-Fidelity <span>Essentials</span>
                    </h1>
                    <p className="editorial-p">
                        A curated sanctuary for the modern connoisseur.
                        Where exceptional design meets uncompromising quality.
                    </p>
                    <div className="hero-btns">
                        <button className="premium-btn editorial-btn" onClick={() => navigate('/new-arrivals')}>
                            Explore the Collection
                        </button>
                        <button className="text-link-btn" onClick={() => navigate('/offers')}>
                            View Seasonal Offers →
                        </button>
                    </div>
                </div>
                <div className="hero-visual">
                    <div className="ambient-field"></div>
                    <img
                        src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1200"
                        alt="Quantum Premium Series"
                        className="hero-img-editorial"
                    />
                    <div className="hero-product-info glass-effect">
                        <div className="info-top">
                            <span className="category">TIMEPIECES</span>
                            <span className="price">₹18,999</span>
                        </div>
                        <h3>Quantum Limited X1</h3>
                    </div>
                </div>
            </div>
            <div className="editorial-scroll">
                <span>SCROLL TO EXPLORE</span>
                <div className="line"></div>
            </div>
        </section>
    );
};

export default Hero;
