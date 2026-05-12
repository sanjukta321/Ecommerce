import { Component, useState, useEffect, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, color: '#64748b', fontFamily: 'inherit' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ fontWeight: 600, fontSize: 15, margin: 0 }}>Something went wrong loading this page.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageLoader() {
  return <div className="app-page-loader"><div className="app-spinner" /></div>;
}
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ToastProvider } from './context/ToastContext';
import { SiteConfigProvider } from './context/SiteConfigContext';
import { frappeApi } from './api/frappe';
import { initCsrfToken } from './services/client';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Contact from './pages/Contact';
import Cart from './pages/Cart';
import Electronics from './pages/Electronics';
import Fashion from './pages/Fashion';
import Furniture from './pages/Furniture';
import Books from './pages/Books';
import Sports from './pages/Sports';
import Accessories from './pages/Accessories';
import ProductDetail from './pages/ProductDetail';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Offers from './pages/Offers';
import NewArrivals from './pages/NewArrivals';
import SearchResults from './pages/SearchResults';
import SellerLanding from './pages/SellerLanding';
import DealOfTheDay from './components/DealOfTheDay';
import Wishlist from './pages/Wishlist';
import Orders from './pages/Orders';
import Checkout from './pages/Checkout';
import './styles/index.css';

const SellerDashboard  = lazy(() => import('./pages/seller/SellerDashboard'));
const SellerProducts   = lazy(() => import('./pages/seller/SellerProducts'));
const SellerOrders     = lazy(() => import('./pages/seller/SellerOrders'));
const SellerInventory  = lazy(() => import('./pages/seller/SellerInventory'));
const SellerAnalytics  = lazy(() => import('./pages/seller/SellerAnalytics'));
const SellerReturns    = lazy(() => import('./pages/seller/SellerReturns'));
const SellerPayments   = lazy(() => import('./pages/seller/SellerPayments'));
const SellerProfile    = lazy(() => import('./pages/seller/SellerProfile'));
const AdminDashboard   = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts    = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders      = lazy(() => import('./pages/admin/AdminOrders'));
const AdminSellers     = lazy(() => import('./pages/admin/AdminSellers'));
const AdminCustomers   = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminReports     = lazy(() => import('./pages/admin/AdminReports'));
const AdminSettings    = lazy(() => import('./pages/admin/AdminSettings'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function AppInner() {
  const location = useLocation();
  const isSellerRoute = location.pathname.startsWith('/seller');
  const isAdminRoute  = location.pathname.startsWith('/admin');

  const [isLoggedIn, setIsLoggedIn] = useState(() =>
    localStorage.getItem('isLoggedIn') === 'true'
  );

  useEffect(() => {
    initCsrfToken();
    frappeApi.checkSession().then(({ loggedIn }) => {
      if (loggedIn) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('frappe_user');
      }
    });
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
  };

  const handleLogout = async () => {
    try {
      await frappeApi.logout();
    } catch {
      // ignore logout errors
    }
    setIsLoggedIn(false);
    localStorage.setItem('isLoggedIn', 'false');
    localStorage.removeItem('frappe_user');
  };

  return (
    <div className="App">
      {!isSellerRoute && !isAdminRoute && <Navbar isLoggedIn={isLoggedIn} onLogout={handleLogout} />}
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"             element={<Home />} />
          <Route path="/electronics"  element={<Electronics />} />
          <Route path="/fashion/:gender" element={<Fashion />} />
          <Route path="/fashion"      element={<Fashion />} />
          <Route path="/furniture"    element={<Furniture />} />
          <Route path="/books"        element={<Books />} />
          <Route path="/sports"       element={<Sports />} />
          <Route path="/accessories"  element={<Accessories />} />
          <Route path="/product/:id"  element={<ProductDetail />} />
          <Route path="/offers"       element={<Offers />} />
          <Route path="/new-arrivals" element={<NewArrivals />} />
          <Route path="/contact"      element={<Contact />} />
          <Route path="/search"       element={<SearchResults />} />
          <Route path="/account"      element={<Navigate to="/profile" replace />} />
          <Route path="/profile"      element={<Profile onLogout={handleLogout} />} />
          <Route path="/login"        element={<Login onLogin={handleLogin} />} />
          <Route path="/cart"         element={<Cart />} />
          <Route path="/wishlist"     element={<Wishlist />} />
          <Route path="/orders"       element={<Orders />} />
          <Route path="/checkout"     element={isLoggedIn ? <Checkout /> : <Navigate to="/login?next=/checkout" replace />} />
          <Route path="/become-seller" element={<SellerLanding />} />
          {/* Seller routes — lazy-loaded, not bundled on initial page load */}
          <Route path="/seller"              element={<Navigate to="/seller/dashboard" replace />} />
          <Route path="/seller/login"        element={<Navigate to="/login" replace />} />
          <Route path="/seller/dashboard"    element={<SellerDashboard />} />
          <Route path="/seller/products"     element={<SellerProducts />} />
          <Route path="/seller/orders"       element={<SellerOrders />} />
          <Route path="/seller/inventory"    element={<SellerInventory />} />
          <Route path="/seller/analytics"    element={<SellerAnalytics />} />
          <Route path="/seller/returns"      element={<SellerReturns />} />
          <Route path="/seller/payments"     element={<SellerPayments />} />
          <Route path="/seller/profile"      element={<SellerProfile />} />
          {/* Admin routes — lazy-loaded, not bundled on initial page load */}
          <Route path="/admin"               element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login"         element={<Navigate to="/login" replace />} />
          <Route path="/admin/dashboard"     element={<AdminDashboard />} />
          <Route path="/admin/products"      element={<AdminProducts />} />
          <Route path="/admin/orders"        element={<AdminOrders />} />
          <Route path="/admin/sellers"       element={<AdminSellers />} />
          <Route path="/admin/customers"     element={<AdminCustomers />} />
          <Route path="/admin/reports"       element={<AdminReports />} />
          <Route path="/admin/settings"      element={<AdminSettings />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
      {!isSellerRoute && !isAdminRoute && <DealOfTheDay />}
    </div>
  );
}

function App() {
  return (
    <SiteConfigProvider>
      <ToastProvider>
        <CartProvider>
          <WishlistProvider>
            <Router basename="/shop">
              <ScrollToTop />
              <AppInner />
            </Router>
          </WishlistProvider>
        </CartProvider>
      </ToastProvider>
    </SiteConfigProvider>
  );
}

export default App;
