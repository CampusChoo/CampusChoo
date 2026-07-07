import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/authStore';
import { CartProvider } from './lib/cartStore';
import { ThemeProvider } from './lib/themeStore';

// Home is the landing page — eagerly loaded so first paint isn't blocked by
// a lazy-chunk fetch on cold visits.
import Home from './pages/Home';

// Every other route is code-split: each page only downloads when navigated
// to. Keeps the initial bundle small and stops dashboard-only code from
// slowing down the rest.
const Vendors      = lazy(() => import('./pages/Vendors'));
const Menu         = lazy(() => import('./pages/Menu'));
const Checkout     = lazy(() => import('./pages/Checkout'));
const Track        = lazy(() => import('./pages/Track'));
const Account      = lazy(() => import('./pages/Account'));
const VendorPortal = lazy(() => import('./pages/VendorPortal'));
const Products     = lazy(() => import('./pages/Products'));
const About        = lazy(() => import('./pages/About'));

function RouteFallback() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--cc-bg, #080706)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid rgba(244,82,30,0.25)', borderTopColor: '#F4521E',
        animation: 'cc-spin 0.9s linear infinite',
      }} />
      <style>{`@keyframes cc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/vendors" element={<Vendors />} />
                <Route path="/menu" element={<Menu />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/track" element={<Track />} />
                <Route path="/track/:orderId" element={<Track />} />
                <Route path="/account" element={<Account />} />
                <Route path="/portal" element={<VendorPortal />} />
                <Route path="/products" element={<Products />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
