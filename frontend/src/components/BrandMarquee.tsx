import React from 'react';
import '../styles/BrandMarquee.css';

const brands = [
    'ROLEX', 'PORSCHE', 'SONY', 'LEICA', 'APPLE', 'BOSE', 'BANG & OLUFSEN', 'CARTIER', 'PRADA', 'TESLA'
];

const BrandMarquee: React.FC = () => {
    return (
        <div className="brand-marquee-container">
            <div className="marquee-content">
                {/* Repeat twice for continuous loop */}
                {[...brands, ...brands].map((brand, index) => (
                    <span key={index} className="brand-item">{brand}</span>
                ))}
            </div>
        </div>
    );
};

export default BrandMarquee;
