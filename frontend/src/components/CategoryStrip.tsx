import { useNavigate } from 'react-router-dom';
import '../styles/CategoryStrip.css';

const categories = [
    { name: 'Electronics', icon: '📱', path: '/electronics' },
    { name: 'Fashion', icon: '👔', path: '/fashion' },
    { name: 'Furniture', icon: '🛋️', path: '/furniture' },
    { name: 'Books', icon: '📚', path: '/books' },
    { name: 'Sports', icon: '⚽', path: '/sports' },
    { name: 'Accessories', icon: '⌚', path: '/accessories' },
    { name: 'Sale', icon: '🔥', path: '/offers' }
];

const CategoryStrip: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="category-strip container fade-in">
            {categories.map((cat, index) => (
                <div
                    key={index}
                    className="category-item glass-effect"
                    onClick={() => navigate(cat.path)}
                    style={{ cursor: 'pointer' }}
                >
                    <span className="cat-icon">{cat.icon}</span>
                    <span className="cat-name">{cat.name}</span>
                </div>
            ))}
        </div>
    );
};

export default CategoryStrip;
