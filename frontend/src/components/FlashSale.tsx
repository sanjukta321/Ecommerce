import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/FlashSale.css';

const FlashSale: React.FC = () => {
    const navigate = useNavigate();
    const [timeLeft, setTimeLeft] = useState(3600 * 24); // 24 hours in seconds

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <section className="flash-sale container">
            <div className="flash-card glass-effect fade-in">
                <div className="flash-content">
                    <span className="limited-tag">Limited Time Offer</span>
                    <h2>Flash <span>Sale</span></h2>
                    <p>Get up to 70% off on selected high-end fashion and electronics.</p>
                    <div className="timer">
                        <span>Ends In:</span>
                        <div className="time-box">{formatTime(timeLeft)}</div>
                    </div>
                    <button className="premium-btn" onClick={() => navigate('/offers')}>Shop Now</button>
                </div>
                <div className="flash-visual">
                    <div className="glow-accent"></div>
                    <img src="https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&q=80&w=800" alt="Flash Sale" />
                </div>
            </div>
        </section>
    );
};

export default FlashSale;
