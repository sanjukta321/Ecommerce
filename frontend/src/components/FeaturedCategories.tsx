import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/FeaturedCategories.css';

const featured = [
    {
        name: 'Electronics',
        path: '/electronics',
        image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=800',
        cols: 'col-2'
    },
    {
        name: 'Fashion',
        path: '/fashion',
        image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800',
        cols: 'col-1'
    },
    {
        name: 'Luxury Furniture',
        path: '/furniture',
        image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800',
        cols: 'col-1'
    },
    {
        name: 'Elite Sports',
        path: '/sports',
        image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=800',
        cols: 'col-2'
    }
];

const FeaturedCategories: React.FC = () => {
    const navigate = useNavigate();

    return (
        <section className="featured-categories container fade-in">
            <div className="section-header">
                <h2>Browse <span>Categories</span></h2>
            </div>
            <div className="feat-grid">
                {featured.map((cat, index) => (
                    <div
                        key={index}
                        className={`feat-card ${cat.cols}`}
                        onClick={() => navigate(cat.path)}
                    >
                        <img src={cat.image} alt={cat.name} />
                        <div className="feat-overlay">
                            <h3>{cat.name}</h3>
                            <span className="shop-link">Explore Now</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default FeaturedCategories;
