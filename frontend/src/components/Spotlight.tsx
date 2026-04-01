import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Spotlight.css';

const Spotlight: React.FC = () => {
    const navigate = useNavigate();

    return (
        <section className="spotlight container fade-in">
            <div className="spotlight-content">
                <div className="spotlight-visual">
                    <img
                        src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1200"
                        alt="Signature Performance"
                    />
                    <div className="spotlight-meta">
                        <span className="year">EDITION 2026</span>
                        <span className="serial">SN-00249</span>
                    </div>
                </div>
                <div className="spotlight-text">
                    <span className="label">DESIGNER SPOTLIGHT</span>
                    <h2>The <span>Aero-Dynamic</span> Elite Series</h2>
                    <p>
                        Engineered for elite performance. Designed for those who demand excellence
                        at every step. A synthesis of luxury materials and cutting-edge biometrics.
                    </p>
                    <button className="premium-btn" onClick={() => navigate('/fashion')}>
                        DISCOVER THE SERIES
                    </button>
                </div>
            </div>
        </section>
    );
};

export default Spotlight;
