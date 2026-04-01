import React, { useState } from 'react';
import '../styles/DealOfTheDay.css';

const DealOfTheDay: React.FC = () => {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div className="deal-fab glass-effect fade-in">
            <button className="close-fab" onClick={() => setIsVisible(false)}>×</button>
            <div className="deal-content">
                <span className="deal-badge">Hot Deal</span>
                <h4>Quantum Sound Max</h4>
                <p>₹4,999 <span className="old-price">₹12,499</span></p>
                <button className="grab-btn">Grab Now</button>
            </div>
        </div>
    );
};

export default DealOfTheDay;
