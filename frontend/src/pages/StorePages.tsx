import React from 'react';
import Footer from '../components/Footer';

const PageTemplate: React.FC<{ title: string }> = ({ title }) => (
    <div className="store-page fade-in">
        <div className="container">
            <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>{title}</h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '18px' }}>
                This page is under development. Our premium curated {title} collection will be available soon.
            </p>
        </div>
        <Footer />
    </div>
);

export const Account = () => <PageTemplate title="My Account" />;
export const Cart = () => <PageTemplate title="Shopping Cart" />;
