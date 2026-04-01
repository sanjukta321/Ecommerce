import React from 'react';
import '../styles/ValueProps.css';

const props = [
    {
        icon: '🚚',
        title: 'Free Shipping',
        desc: 'On all orders over ₹5,000'
    },
    {
        icon: '💎',
        title: 'Premium Quality',
        desc: 'Curated high-end products'
    },
    {
        icon: '🔒',
        title: 'Secure Payment',
        desc: '100% protected transactions'
    },
    {
        icon: '🎧',
        title: '24/7 Support',
        desc: 'Dedicated concierge service'
    }
];

const ValueProps: React.FC = () => {
    return (
        <section className="value-props container fade-in">
            <div className="props-grid">
                {props.map((prop, index) => (
                    <div key={index} className="prop-card glass-effect">
                        <span className="prop-icon">{prop.icon}</span>
                        <div className="prop-info">
                            <h3>{prop.title}</h3>
                            <p>{prop.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ValueProps;
