import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { allProducts } from '../data/allProducts';
import type { Product } from '../data/allProducts';
import { frappeApi } from '../api/frappe';
import { mapToProduct } from '../hooks/useFrappeProducts';
import { useCart } from '../context/CartContext';
import { useSiteConfig } from '../context/SiteConfigContext';
import { BrandLogo } from './BrandLogo';
import '../styles/Navbar.css';

interface NavbarProps {
    isLoggedIn: boolean;
    onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ isLoggedIn, onLogout }) => {
    const { app_name } = useSiteConfig();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Product[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [showAccountDropdown, setShowAccountDropdown] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { cartCount } = useCart();
    const accountDropdownRef = React.useRef<HTMLDivElement>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const savedTheme = localStorage.getItem('theme');
        return (savedTheme as 'light' | 'dark') || 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Sync input with URL when navigating to/from search page
    useEffect(() => {
        if (location.pathname === '/search') {
            const params = new URLSearchParams(location.search);
            const q = params.get('q') || '';
            setSearchQuery(q);
        } else {
            setSearchQuery('');
        }
        setShowSuggestions(false);
    }, [location.pathname, location.search]);

    // Cache of Frappe products so we only fetch once per session
    const frappeCache = useRef<Product[]>([]);

    useEffect(() => {
        const q = searchQuery.trim();
        if (q.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            setActiveIndex(-1);
            return;
        }

        const query = q.toLowerCase();
        const tokens = query.split(/\s+/).filter(t => t.length >= 2);

        function matches(p: Product): boolean {
            const fields = [
                p.name,
                p.category,
                p.gender ?? '',
                ...(p.tags ?? []),
            ].join(' ').toLowerCase();
            // Every token must appear somewhere in the fields
            return tokens.every(token => fields.includes(token));
        }

        // Immediate: search static products
        const staticHits = allProducts.filter(matches);

        // Merge with cached Frappe results
        const frappe = frappeCache.current;
        const frappeIds = new Set(frappe.map(p => p.id));
        const merged = [
            ...frappe.filter(matches),
            ...staticHits.filter(p => !frappeIds.has(p.id)),
        ].slice(0, 8);

        setSuggestions(merged);
        setShowSuggestions(merged.length > 0);
        setActiveIndex(-1);

        // Debounced Frappe fetch (only if cache is empty)
        let cancelled = false;
        const timer = setTimeout(async () => {
            if (cancelled || frappeCache.current.length > 0) return;
            try {
                const res = await frappeApi.getProducts();
                if (!cancelled && res.data?.length) {
                    frappeCache.current = res.data.map(mapToProduct);
                    const updatedFrappe = frappeCache.current;
                    const updatedIds = new Set(updatedFrappe.map(p => p.id));
                    const updatedMerged = [
                        ...updatedFrappe.filter(matches),
                        ...staticHits.filter(p => !updatedIds.has(p.id)),
                    ].slice(0, 8);
                    setSuggestions(updatedMerged);
                    setShowSuggestions(updatedMerged.length > 0);
                }
            } catch { }
        }, 350);

        return () => { cancelled = true; clearTimeout(timer); };
    }, [searchQuery]);

    // Handle click outside to close suggestions and account dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.search-bar-container')) {
                setShowSuggestions(false);
            }
            if (accountDropdownRef.current && !accountDropdownRef.current.contains(target)) {
                setShowAccountDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light') as 'light' | 'dark');
    };

    const handleSearch = (e: React.FormEvent | React.MouseEvent) => {
        e.preventDefault();
        const q = searchQuery.trim();
        if (q) {
            navigate(`/search?q=${encodeURIComponent(q)}`);
            setShowSuggestions(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchQuery(value);
        // Live search: update results immediately while on the search page
        if (location.pathname === '/search' && value.trim().length > 1) {
            navigate(`/search?q=${encodeURIComponent(value.trim())}`, { replace: true });
        }
    };

    const handleSuggestionClick = (product: Product) => {
        navigate(`/product/${product.id}`);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((prev: number) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((prev: number) => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            handleSuggestionClick(suggestions[activeIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const close = () => setIsMenuOpen(false);

    const MegaMenuContent = () => (
        <div className="mega-menu glass-effect">
            <div className="mega-grid">
                <div className="mega-col">
                    <h3>Electronics</h3>
                    <ul>
                        <li><Link to="/electronics" onClick={close}>All Electronics</Link></li>
                        <li><Link to="/electronics" onClick={close}>Mobiles</Link></li>
                        <li><Link to="/electronics" onClick={close}>Laptops</Link></li>
                    </ul>
                </div>
                <div className="mega-col">
                    <h3>Fashion</h3>
                    <ul>
                        <li><Link to="/fashion/men" onClick={close}>Men's Wear</Link></li>
                        <li><Link to="/fashion/women" onClick={close}>Women's Wear</Link></li>
                        <li><Link to="/fashion/kids" onClick={close}>Kids' Wear</Link></li>
                    </ul>
                </div>
                <div className="mega-col">
                    <h3>Home & Life</h3>
                    <ul>
                        <li><Link to="/furniture" onClick={close}>Furniture</Link></li>
                        <li><Link to="/books" onClick={close}>Books & Media</Link></li>
                        <li><Link to="/sports" onClick={close}>Sports & Fitness</Link></li>
                        <li><Link to="/accessories" onClick={close}>Accessories</Link></li>
                    </ul>
                </div>
                <div className="mega-col">
                    <h3>Offers</h3>
                    <ul>
                        <li><Link to="/offers" onClick={close}>Flash Sale</Link></li>
                        <li><Link to="/new-arrivals" onClick={close}>New Arrivals</Link></li>
                        <li><Link to="/offers" onClick={close}>Clearance Sale</Link></li>
                    </ul>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <nav className="navbar">
                <div className="nav-content">
                    <div className="logo">
                        <Link to="/" style={{ textDecoration: 'none' }}>
                            <BrandLogo appName={app_name} size="md" />
                        </Link>
                    </div>

                    {/* Desktop search */}
                    <div className="search-bar-container">
                        <form className="search-bar" onSubmit={handleSearch}>
                            <input
                                type="text"
                                placeholder="Search products (e.g., saree, iphone)..."
                                value={searchQuery}
                                onChange={handleInputChange}
                                onFocus={() => searchQuery.length > 1 && setShowSuggestions(true)}
                                onKeyDown={handleKeyDown}
                            />
                            <button type="submit">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                            </button>
                        </form>

                        {showSuggestions && suggestions.length > 0 && (
                            <div className="suggestions-dropdown glass-effect">
                                <div className="suggestions-list">
                                    {suggestions.map((product: Product, index: number) => (
                                        <div
                                            key={product.id}
                                            className={`suggestion-item ${index === activeIndex ? 'active' : ''}`}
                                            onClick={() => handleSuggestionClick(product)}
                                        >
                                            <div className="suggestion-image">
                                                <img src={product.image} alt={product.name} />
                                            </div>
                                            <div className="suggestion-info">
                                                <div className="suggestion-name">{product.name}</div>
                                                <div className="suggestion-category">in {product.category}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="suggestion-footer" onClick={handleSearch}>
                                    See all results for "{searchQuery}"
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Desktop nav links */}
                    <ul className="nav-links">
                        <li><Link to="/">Home</Link></li>
                        <li className="mega-menu-trigger">
                            <Link to="#" onClick={e => e.preventDefault()}>Shop ▾</Link>
                            <MegaMenuContent />
                        </li>
                        <li><Link to="/offers">Offers</Link></li>
                        <li><Link to="/new-arrivals">New Arrivals</Link></li>
                        <li><Link to="/contact">Contact Us</Link></li>
                        <li>
                            <Link to="/become-seller" className="sell-link" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                                Sell on {app_name}
                            </Link>
                        </li>
                    </ul>

                    <div className="nav-actions">
                        <button className="theme-toggle action-item" onClick={toggleTheme} title="Toggle Theme">
                            {theme === 'dark' ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                            )}
                            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                        </button>
                        {!isLoggedIn ? (
                            <div className="account-dropdown-trigger">
                                <Link to="/login" className="action-item login-trigger highlight">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" x2="3" y1="12" y2="12" /></svg>
                                    <span>Login</span>
                                </Link>
                                <div className="account-dropdown glass-effect guest-dropdown">
                                    <div className="dropdown-info">
                                        <h3>Welcome</h3>
                                        <p>To access orders and wishlist</p>
                                        <Link to="/login" className="login-btn">LOGIN</Link>
                                        <div style={{ marginTop: '15px' }}>
                                            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>New customer?</p>
                                            <Link
                                                to="/login"
                                                state={{ startSignup: true }}
                                                className="signup-btn-dropdown"
                                            >
                                                SIGNUP
                                            </Link>
                                        </div>
                                    </div>
                                    <div className="divider"></div>
                                    <ul>
                                        <li>
                                            <Link to="/login">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                                                Orders
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/login">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                                Wishlist
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/login">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                                                Gift Cards
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/contact">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                                Contact Us
                                            </Link>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        ) : (
                            <div className="account-dropdown-trigger" ref={accountDropdownRef}>
                                <button
                                    className="action-item"
                                    onClick={() => setShowAccountDropdown(prev => !prev)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                    <span>Account</span>
                                </button>
                                <div className={`account-dropdown glass-effect${showAccountDropdown ? ' open' : ''}`}>
                                    <div className="dropdown-info">
                                        <h3>Hello, {localStorage.getItem('frappe_user') || 'User'}</h3>
                                        <p>Manage your account & orders</p>
                                    </div>
                                    <div className="divider"></div>
                                    <ul>
                                        <li>
                                            <Link to="/profile" onClick={() => setShowAccountDropdown(false)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                My Profile
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/orders" onClick={() => setShowAccountDropdown(false)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                                                Orders
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/wishlist" onClick={() => setShowAccountDropdown(false)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                                Wishlist
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/profile" onClick={() => setShowAccountDropdown(false)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                                                Gift Cards
                                            </Link>
                                        </li>
                                        <li>
                                            <Link to="/profile" onClick={() => setShowAccountDropdown(false)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                                                Coupons
                                            </Link>
                                        </li>
                                        {localStorage.getItem('seller_session') && (
                                            <>
                                                <li className="divider"></li>
                                                <li>
                                                    <Link to="/seller/dashboard" onClick={() => setShowAccountDropdown(false)} style={{ color: '#6c63ff', fontWeight: 600 }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                                        Seller Dashboard
                                                    </Link>
                                                </li>
                                            </>
                                        )}
                                        <li className="divider"></li>
                                        <li>
                                            <Link
                                                to="/"
                                                className="logout"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setShowAccountDropdown(false);
                                                    onLogout();
                                                    navigate('/');
                                                }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                                Logout
                                            </Link>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}
                        <Link to="/cart" className="action-item cart">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.71a2 2 0 0 0 2-1.61l1.71-8.55H5.41" /></svg>
                            {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
                        </Link>
                        <button className="mobile-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                            <span></span>
                            <span></span>
                            <span></span>
                        </button>
                    </div>
                </div>

            </nav>

            {/* Mobile menu — outside <nav> so backdrop-filter doesn't trap fixed positioning */}
            {isMenuOpen && (
                <div className="mobile-menu-overlay">
                    <div className="mobile-menu-search">
                        <form className="search-bar" style={{ width: '100%' }} onSubmit={(e) => { handleSearch(e); close(); }}>
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={handleInputChange}
                            />
                            <button type="submit">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                            </button>
                        </form>
                    </div>

                    <ul className="mobile-nav-list">
                        <li><Link to="/" onClick={close}>Home</Link></li>

                        <li className="mobile-section-label">Shop</li>
                        <li className="mobile-sub"><Link to="/electronics" onClick={close}>Electronics</Link></li>
                        <li className="mobile-sub"><Link to="/fashion/men" onClick={close}>Men's Fashion</Link></li>
                        <li className="mobile-sub"><Link to="/fashion/women" onClick={close}>Women's Fashion</Link></li>
                        <li className="mobile-sub"><Link to="/fashion/kids" onClick={close}>Kids' Fashion</Link></li>
                        <li className="mobile-sub"><Link to="/furniture" onClick={close}>Furniture</Link></li>
                        <li className="mobile-sub"><Link to="/books" onClick={close}>Books & Media</Link></li>
                        <li className="mobile-sub"><Link to="/sports" onClick={close}>Sports & Fitness</Link></li>
                        <li className="mobile-sub"><Link to="/accessories" onClick={close}>Accessories</Link></li>

                        <li><Link to="/offers" onClick={close}>Offers</Link></li>
                        <li><Link to="/new-arrivals" onClick={close}>New Arrivals</Link></li>
                        <li><Link to="/contact" onClick={close}>Contact Us</Link></li>
                        <li>
                            <Link to="/become-seller" onClick={close} style={{ color: 'var(--accent)', fontWeight: 800 }}>
                                Sell on {app_name}
                            </Link>
                        </li>
                    </ul>
                </div>
            )}
        </>
    );
};

export default Navbar;
