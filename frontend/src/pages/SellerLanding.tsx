import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import '../styles/SellerLanding.css';

const stats = [
    { number: '50,000+', label: 'Active Sellers' },
    { number: '2 Crore+', label: 'Products Listed' },
    { number: '500+', label: 'Cities Reached' },
    { number: '₹1000 Crore+', label: 'Seller Payouts' },
];

const steps = [
    {
        number: '1',
        title: 'Register as Seller',
        description: 'Create your seller account in minutes with just basic details.',
    },
    {
        number: '2',
        title: 'List Your Products',
        description: 'Upload products with photos, price, and stock details easily.',
    },
    {
        number: '3',
        title: 'Start Earning',
        description: 'We handle delivery logistics — you get paid fast and reliably.',
    },
];

const benefits = [
    {
        icon: '🆓',
        color: 'rgba(108, 99, 255, 0.18)',
        title: 'Zero Registration Fee',
        description: 'Start selling for free. No upfront cost, no hidden charges.',
    },
    {
        icon: '⚡',
        color: 'rgba(247, 201, 72, 0.18)',
        title: 'Fast Payments',
        description: 'Get paid within 7 days of order delivery directly to your bank.',
    },
    {
        icon: '🌏',
        color: 'rgba(52, 211, 153, 0.18)',
        title: 'Pan-India Reach',
        description: 'Sell to millions of customers in 500+ cities across India.',
    },
    {
        icon: '↩️',
        color: 'rgba(251, 113, 133, 0.18)',
        title: 'Easy Returns',
        description: 'We handle return logistics end-to-end so you can focus on selling.',
    },
    {
        icon: '🛡️',
        color: 'rgba(96, 165, 250, 0.18)',
        title: 'Seller Protection',
        description: '100% payment guarantee on every fulfilled order. No payment risk.',
    },
    {
        icon: '📊',
        color: 'rgba(167, 139, 250, 0.18)',
        title: 'Analytics Dashboard',
        description: 'Track sales, revenue, and growth with detailed real-time insights.',
    },
];

const featuredSellers = [
    {
        initials: 'RE',
        avatarColor: 'linear-gradient(135deg, #6c63ff, #3b3a8f)',
        name: 'Ravi Electronics',
        category: 'Electronics',
        rating: '★4.8',
        sales: '₹12,45,000',
    },
    {
        initials: 'PF',
        avatarColor: 'linear-gradient(135deg, #ec4899, #be185d)',
        name: 'Priya Fashion Hub',
        category: 'Fashion',
        rating: '★4.9',
        sales: '₹8,30,000',
    },
    {
        initials: 'KH',
        avatarColor: 'linear-gradient(135deg, #10b981, #065f46)',
        name: 'Kumar Home Decor',
        category: 'Furniture',
        rating: '★4.7',
        sales: '₹6,75,000',
    },
];

const faqs = [
    {
        question: 'How do I register as a seller?',
        answer:
            'Click "Start Selling Now", fill in your basic business details, verify your phone number and email, and you\'re ready to start listing products.',
    },
    {
        question: 'What documents do I need?',
        answer:
            'You need a valid GST number, PAN card, and your bank account details for receiving payouts.',
    },
    {
        question: 'How much does SB Store charge?',
        answer:
            'Commission ranges from 2–15% depending on the product category. There are zero listing fees and no monthly charges.',
    },
    {
        question: 'When do I get paid?',
        answer:
            'Payments are transferred to your bank account within 7 business days after the order is delivered to the customer.',
    },
    {
        question: 'Can I sell from anywhere in India?',
        answer:
            'Yes! We arrange pickup from your location anywhere across India. Just list your products and we take care of logistics.',
    },
];

const SellerLanding: React.FC = () => {
    const navigate = useNavigate();
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const toggleFaq = (index: number) => {
        setOpenFaq(prev => (prev === index ? null : index));
    };

    return (
        <div className="seller-landing fade-in">

            {/* ── Hero ── */}
            <section className="sl-hero">
                <div className="sl-hero-content">
                    <h1>Grow Your Business with SB Store</h1>
                    <p>
                        Join 50,000+ sellers. Reach crores of customers across India.
                        Start selling in minutes.
                    </p>
                    <div className="sl-hero-btns">
                        <button
                            className="sl-btn-primary"
                            onClick={() => navigate('/login?mode=seller')}
                        >
                            Start Selling Now
                        </button>
                        <button
                            className="sl-btn-outline"
                            onClick={() => navigate(localStorage.getItem('seller_session') ? '/seller/dashboard' : '/login?mode=seller')}
                        >
                            Explore Seller Dashboard
                        </button>
                    </div>
                </div>
            </section>

            {/* ── Stats ── */}
            <section className="sl-stats">
                <div className="sl-stats-grid">
                    {stats.map((stat, i) => (
                        <div key={i} className="sl-stat-card">
                            <div className="sl-stat-number">{stat.number}</div>
                            <div className="sl-stat-label">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── How It Works ── */}
            <section className="sl-how-it-works">
                <div className="sl-section-title">
                    <h2>How It Works</h2>
                    <p>Get started in three simple steps and begin earning today.</p>
                </div>
                <div className="sl-steps-grid">
                    {steps.map((step, i) => (
                        <div key={i} className="sl-step-card">
                            <div className="sl-step-number">{step.number}</div>
                            <h3>{step.title}</h3>
                            <p>{step.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Benefits ── */}
            <section className="sl-benefits">
                <div className="sl-section-title">
                    <h2>Why Sell on SB Store?</h2>
                    <p>Everything you need to run and grow a successful online business.</p>
                </div>
                <div className="sl-benefits-grid">
                    {benefits.map((b, i) => (
                        <div key={i} className="sl-benefit-card">
                            <div
                                className="sl-benefit-icon"
                                style={{ background: b.color }}
                            >
                                {b.icon}
                            </div>
                            <h3>{b.title}</h3>
                            <p>{b.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Featured Sellers ── */}
            <section className="sl-sellers-showcase">
                <div className="sl-section-title">
                    <h2>Success Stories</h2>
                    <p>Meet some of our top-performing sellers building great businesses.</p>
                </div>
                <div className="sl-sellers-grid">
                    {featuredSellers.map((seller, i) => (
                        <div key={i} className="sl-seller-card">
                            <div
                                className="sl-seller-avatar"
                                style={{ background: seller.avatarColor }}
                            >
                                {seller.initials}
                            </div>
                            <div className="sl-seller-name">{seller.name}</div>
                            <div className="sl-seller-category">{seller.category}</div>
                            <div className="sl-seller-rating">{seller.rating}</div>
                            <div className="sl-seller-sales">
                                Total Sales: <span>{seller.sales}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className="sl-faq">
                <div className="sl-section-title">
                    <h2>Frequently Asked Questions</h2>
                    <p>Got questions? We have answers.</p>
                </div>
                <div className="sl-faq-list">
                    {faqs.map((faq, i) => (
                        <div
                            key={i}
                            className={`sl-faq-item${openFaq === i ? ' open' : ''}`}
                        >
                            <button
                                className="sl-faq-question"
                                onClick={() => toggleFaq(i)}
                                aria-expanded={openFaq === i}
                            >
                                {faq.question}
                                <svg
                                    className="sl-faq-chevron"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </button>
                            <div className="sl-faq-answer">
                                <p>{faq.answer}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA Banner ── */}
            <section className="sl-cta-banner">
                <div className="sl-cta-banner-content">
                    <h2>Ready to Start Selling?</h2>
                    <p>
                        Join thousands of sellers already growing their business on SB Store.
                        Setup takes less than 5 minutes.
                    </p>
                    <button
                        className="sl-btn-cta"
                        onClick={() => navigate('/login?mode=seller')}
                    >
                        Create Seller Account
                    </button>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default SellerLanding;
