import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/authStore';
import { CartProvider } from './lib/cartStore';
import Home from './pages/Home';
import Vendors from './pages/Vendors';
import Menu from './pages/Menu';
import Checkout from './pages/Checkout';
import Track from './pages/Track';
import Account from './pages/Account';
import VendorPortal from './pages/VendorPortal';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/track" element={<Track />} />
            <Route path="/track/:orderId" element={<Track />} />
            <Route path="/account" element={<Account />} />
            <Route path="/portal" element={<VendorPortal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
