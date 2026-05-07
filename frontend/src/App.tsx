import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ToastProvider } from './context/ToastContext';
import { SiteConfigProvider } from './context/SiteConfigContext';
import { frappeApi } from './api/frappe';
import { initCsrfToken } from './services/client';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Contact from './pages/Contact';
import { Account } from './pages/StorePages';
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
import SellerDashboard from './pages/seller/SellerDashboard';
import SellerProducts from './pages/seller/SellerProducts';
import SellerOrders from './pages/seller/SellerOrders';
import SellerInventory from './pages/seller/SellerInventory';
import SellerAnalytics from './pages/seller/SellerAnalytics';
import SellerReturns from './pages/seller/SellerReturns';
import SellerPayments from './pages/seller/SellerPayments';
import SellerProfile from './pages/seller/SellerProfile';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSellers from './pages/admin/AdminSellers';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';
import Wishlist from './pages/Wishlist';
import Orders from './pages/Orders';
import Checkout from './pages/Checkout';
import './styles/index.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function AppInner() {
  const location = useLocation();
  const isSellerRoute = location.pathname.startsWith('/seller');
  const isAdminRoute = location.pathname.startsWith('/admin');

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });

  useEffect(() => {
    // Pre-fetch CSRF token so POST requests are ready immediately
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/electronics" element={<Electronics />} />
          <Route path="/fashion/:gender" element={<Fashion />} />
          <Route path="/fashion" element={<Fashion />} />
          <Route path="/furniture" element={<Furniture />} />
          <Route path="/books" element={<Books />} />
          <Route path="/sports" element={<Sports />} />
          <Route path="/accessories" element={<Accessories />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/new-arrivals" element={<NewArrivals />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/account" element={<Account />} />
          <Route path="/profile" element={<Profile onLogout={handleLogout} />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/become-seller" element={<SellerLanding />} />
          {/* Seller routes */}
          <Route path="/seller" element={<Navigate to="/seller/dashboard" replace />} />
          <Route path="/seller/login" element={<Navigate to="/login" replace />} />
          <Route path="/seller/dashboard" element={<SellerDashboard />} />
          <Route path="/seller/products" element={<SellerProducts />} />
          <Route path="/seller/orders" element={<SellerOrders />} />
          <Route path="/seller/inventory" element={<SellerInventory />} />
          <Route path="/seller/analytics" element={<SellerAnalytics />} />
          <Route path="/seller/returns" element={<SellerReturns />} />
          <Route path="/seller/payments" element={<SellerPayments />} />
          <Route path="/seller/profile" element={<SellerProfile />} />
          {/* Admin routes */}
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login" element={<Navigate to="/login" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/sellers" element={<AdminSellers />} />
          <Route path="/admin/customers" element={<AdminCustomers />} />
          <Route path="/admin/reports" element={<AdminReports />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Routes>
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
