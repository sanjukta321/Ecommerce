import React from 'react';
import '../styles/ValueProps.css';

const props = [
    {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="1" />
                <path d="M16 8h4l3 5v3h-7V8z" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
        ),
        title: 'Free Shipping',
        desc: 'On all orders over ₹5,000'
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
        ),
        title: 'Premium Quality',
        desc: 'Curated high-end products'
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
        ),
        title: 'Secure Payment',
        desc: '100% protected transactions'
    },
    {
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0118 0v6" />
                <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
            </svg>
        ),
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
