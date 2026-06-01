import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/authStore';
import { useCart } from '../lib/cartStore';
import { useTheme } from '../lib/themeStore';

const ORANGE = '#F4521E';

// `variant` overrides the theme — used by pages that have a fixed background
// (e.g. Home/Vendors/Menu always cream). When omitted, the navbar follows the
// global theme toggle.
export default function Navbar({ variant }: { variant?: 'dark' | 'cream' }) {
  const { user } = useAuth();
  const { count } = useCart();
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();

  const resolvedVariant = variant ?? (theme === 'light' ? 'cream' : 'dark');
  const isCream = resolvedVariant === 'cream';
  const bg        = isCream ? 'rgba(253,246,236,0.92)' : 'rgba(8,7,6,0.88)';
  const border    = isCream ? 'rgba(0,0,0,0.08)'       : 'rgba(255,255,255,0.07)';
  const linkColor = isCream ? '#7A6E65'                : '#9A8E85';
  const logoColor = isCream ? '#0F0D0A'                : '#fff';

  const links = [
    { to: '/', label: 'Home' },
    { to: '/vendors', label: 'Vendors' },
    { to: '/menu', label: 'Menu' },
    { to: '/track', label: 'Track' },
    { to: '/about', label: 'About' },
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 5%', height: 64,
      background: bg, backdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${border}`,
      fontFamily: "'Inter', sans-serif",
    }}>
      <Link to="/" style={{
        fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800,
        fontSize: 22, color: logoColor, textDecoration: 'none', letterSpacing: '-0.5px',
      }}>
        Campus<span style={{ color: ORANGE }}>Choo</span>
      </Link>

      <ul style={{ display: 'flex', gap: 28, listStyle: 'none', margin: 0, padding: 0 }} className="cc-nav-links">
        {links.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to} end={l.to === '/'} style={({ isActive }) => ({
              textDecoration: 'none',
              color: isActive ? ORANGE : linkColor,
              fontSize: 14, fontWeight: isActive ? 700 : 500,
              transition: 'color 0.2s',
            })}>
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {pathname.startsWith('/menu') || pathname.startsWith('/checkout') || count > 0 ? (
          <Link to="/checkout" style={{
            position: 'relative', background: isCream ? '#0F0D0A' : '#fff',
            color: isCream ? '#fff' : '#0F0D0A', padding: '8px 16px',
            borderRadius: 999, fontSize: 13, fontWeight: 600,
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            🛒 Cart
            {count > 0 && (
              <span style={{
                background: ORANGE, color: '#fff', borderRadius: '50%',
                minWidth: 20, height: 20, fontSize: 11, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 5px',
              }}>{count}</span>
            )}
          </Link>
        ) : null}

        {/* Theme toggle — sits beside the Sign In / Portal button */}
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            background: 'transparent',
            border: `1px solid ${border}`,
            borderRadius: 999, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0,
            color: linkColor, transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = isCream ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {user ? (
          <Link to={user.role === 'VENDOR' ? '/portal' : '/account'} style={{
            background: ORANGE, color: '#fff', padding: '9px 18px',
            borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}>
            {user.role === 'VENDOR' ? 'Portal' : user.name.split(' ')[0]}
          </Link>
        ) : (
          <Link to="/account" style={{
            background: ORANGE, color: '#fff', padding: '9px 18px',
            borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: 'none',
          }}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
