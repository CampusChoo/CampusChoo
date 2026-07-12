import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useCart } from '../lib/cartStore';
import { api } from '../lib/api';

const ORANGE = '#F4521E';
const CREAM = '#FDF6EC';
const TEXT = '#2B2720';
const MUTED = '#8A7E75';
const BORDER = 'rgba(43,39,32,0.09)';

interface Vendor {
  id: string;
  storeName: string;
  isOpen: boolean;
  rating: number;
  location: string;
}

interface MenuItem {
  id: string;
  vendorId: string;
  name: string;
  description?: string | null;
  price: number | string;
  category: string;
  imageUrl?: string | null;
  isAvailable: boolean;
}

export default function Menu() {
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const cart = useCart();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [activeVendorId, setActiveVendorId] = useState(search.get('vendorId') ?? '');
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [vendorError, setVendorError] = useState('');
  const [menuError, setMenuError] = useState('');

  // Load vendors on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/vendors', {}, false);
        if (!res.ok) {
          setVendorError('Could not load vendors. Is the server running?');
          return;
        }
        const list: Vendor[] = await res.json();
        setVendors(list);
        if (!activeVendorId && list.length > 0) {
          setActiveVendorId(list[0].id);
          setSearch({ vendorId: list[0].id }, { replace: true });
        }
      } catch {
        setVendorError('Network error. Is the server running?');
      } finally {
        setLoadingVendors(false);
      }
    })();
  }, []);

  // Load menu items when vendor changes
  useEffect(() => {
    if (!activeVendorId) return;
    setLoadingItems(true);
    setItems([]);
    setMenuError('');
    (async () => {
      try {
        const res = await api(`/api/vendors/${activeVendorId}/menu`, {}, false);
        if (!res.ok) {
          setMenuError('Could not load menu. Please refresh.');
          return;
        }
        setItems(await res.json());
      } catch {
        setMenuError('Network error while loading menu.');
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [activeVendorId]);

  function pickVendor(id: string) {
    setActiveVendorId(id);
    setSearch({ vendorId: id }, { replace: true });
    setActiveCategory('all');
  }

  const activeVendor = vendors.find((v) => v.id === activeVendorId);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    return items.filter((it) => {
      if (!it.isAvailable) return false;
      if (activeCategory !== 'all' && it.category !== activeCategory) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, activeCategory, query]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.isAvailable && set.add(i.category));
    return Array.from(set).sort();
  }, [items]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  function handleAdd(item: MenuItem) {
    if (!activeVendor) return;
    const result = cart.add({
      menuItemId: item.id,
      name: item.name,
      price: Number(item.price),
      imageUrl: item.imageUrl ?? null,
      vendorId: item.vendorId,
      vendorName: activeVendor.storeName,
    });
    if (result.ok) showToast(`✓ ${item.name} added`);
    else showToast(result.message ?? 'Could not add item');
  }

  return (
    <div style={{ background: CREAM, minHeight: '100vh', color: TEXT, fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>
      <Navbar variant="cream" />

      <div style={{ paddingTop: 64, display: 'grid', gridTemplateColumns: '1fr 320px', minHeight: '100vh' }} className="cc-menu-grid">
        {/* Main */}
        <main style={{ padding: '36px 40px 80px', minWidth: 0 }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 36, fontWeight: 800, letterSpacing: -1.5, color: '#0F0D0A', marginBottom: 4 }}>
              Order Food 🍽️
            </h1>
            <p style={{ fontSize: 14, color: MUTED }}>
              Fresh from your favourite campus vendors — delivered to your door.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: MUTED }}>🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for jollof, shawarma, drinks…"
              style={{
                width: '100%', padding: '12px 16px 12px 44px',
                border: `1.5px solid ${BORDER}`, borderRadius: 14,
                fontSize: 14, fontFamily: "'Inter', sans-serif",
                color: TEXT, background: '#fff', outline: 'none',
              }}
            />
          </div>

          {/* Vendor tabs */}
          {loadingVendors ? (
            <p style={{ color: MUTED }}>Loading vendors…</p>
          ) : vendorError ? (
            <ErrorPanel message={vendorError} />
          ) : vendors.length === 0 ? (
            <NoVendors />
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
                {vendors.map((v) => (
                  <button key={v.id} onClick={() => pickVendor(v.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 18px', borderRadius: 999,
                    border: `1.5px solid ${v.id === activeVendorId ? '#0F0D0A' : BORDER}`,
                    background: v.id === activeVendorId ? '#0F0D0A' : '#fff',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    color: v.id === activeVendorId ? '#fff' : MUTED,
                    fontFamily: "'Inter', sans-serif", whiteSpace: 'nowrap',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.isOpen ? '#1A7A3C' : '#9A8E85' }} />
                    {v.storeName}
                  </button>
                ))}
              </div>

              {/* Category pills */}
              {categories.length > 0 && (
                <div style={{
                  display: 'flex', gap: 8, flexWrap: 'wrap',
                  marginBottom: 32, paddingBottom: 20, borderBottom: `1px solid ${BORDER}`,
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginRight: 4 }}>Filter:</span>
                  <CatPill active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>All</CatPill>
                  {categories.map((c) => (
                    <CatPill key={c} active={activeCategory === c} onClick={() => setActiveCategory(c)}>{c}</CatPill>
                  ))}
                </div>
              )}

              {/* Active vendor section */}
              {activeVendor && (
                <div style={{ marginBottom: 24 }}>
                  <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, color: '#0F0D0A', letterSpacing: '-0.5px', marginBottom: 4 }}>
                    {activeVendor.storeName}
                  </h2>
                  <p style={{ fontSize: 12, color: MUTED }}>
                    📍 {activeVendor.location} · ⭐ {activeVendor.rating.toFixed(1)} · {activeVendor.isOpen ? '🟢 Open' : '🔴 Closed'}
                  </p>
                </div>
              )}

              {/* Food grid */}
              {loadingItems ? (
                <p style={{ color: MUTED }}>Loading menu…</p>
              ) : menuError ? (
                <ErrorPanel message={menuError} />
              ) : filteredItems.length === 0 && items.length > 0 ? (
                <p style={{ color: MUTED, padding: 32, textAlign: 'center' }}>No items match your filter.</p>
              ) : items.length === 0 ? (
                <NoItems vendorName={activeVendor?.storeName ?? 'this vendor'} />
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 16,
                }}>
                  {filteredItems.map((it) => (
                    <FoodCard key={it.id} item={it} onAdd={() => handleAdd(it)} />
                  ))}
                </div>
              )}
            </>
          )}
        </main>

        {/* Cart sidebar */}
        <CartSidebar onCheckout={() => navigate('/checkout')} />
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%',
          transform: 'translateX(-50%)',
          background: '#0F0D0A', color: '#fff',
          padding: '12px 24px', borderRadius: 999,
          fontSize: 14, fontWeight: 500, zIndex: 300,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>{toast}</div>
      )}
    </div>
  );
}

function CatPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 16px', borderRadius: 999,
      border: `1px solid ${active ? ORANGE : BORDER}`,
      background: active ? ORANGE : '#fff',
      cursor: 'pointer', fontSize: 13, fontWeight: 500,
      color: active ? '#fff' : MUTED, fontFamily: "'Inter', sans-serif",
    }}>{children}</button>
  );
}

  const CAT_IMG: Record<string, string> = {
    Mains:    '/food/jollof.jpg',
    Proteins: '/food/chicken.webp',
    Soups:    '/food/okro-soup.webp',
    Sides:    '/food/plantain.webp',
    Snacks:   '/food/shawarma.webp',
    Desserts: '/food/OIP (2).webp',
    Combos:   '/food/kenkey.webp',
    Breakfast:'/food/fufu.jpg',
  };

function FoodCard({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  const imgSrc = item.imageUrl
    ? item.imageUrl
    : CAT_IMG[item.category.trim()] ?? '/food/jollof.jpg';

  return (
    <div style={{
      background: '#fff', border: `1px solid ${BORDER}`,
      borderRadius: 18, overflow: 'hidden',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      cursor: 'default',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(43,39,32,0.12)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        width: '100%', height: 150,
        background: 'linear-gradient(135deg, #f5ede4 0%, #ecddd0 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 52, position: 'relative', overflow: 'hidden',
      }}>
        <img
          src={imgSrc}
          alt={item.name}
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {!item.imageUrl && (
          <span style={{ position: 'absolute', fontSize: 44, opacity: 0.2 }}>🍽️</span>
        )}
        {!item.isAvailable && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 700,
            letterSpacing: '0.4px',
          }}>UNAVAILABLE</div>
        )}
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 700,
          color: '#0F0D0A', marginBottom: 3, lineHeight: 1.2,
        }}>{item.name}</div>
        {item.description && (
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 12, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{item.description}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={{
            fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 800, color: ORANGE,
            background: 'rgba(244,82,30,0.08)', padding: '3px 10px', borderRadius: 8,
          }}>
            {Number(item.price) === 0 ? 'FREE' : `GHS ${Number(item.price).toFixed(2)}`}
          </div>
          <button onClick={onAdd} disabled={!item.isAvailable} style={{
            width: 34, height: 34, borderRadius: '50%',
            background: item.isAvailable ? ORANGE : '#C4B8AE',
            color: '#fff', border: 'none',
            fontSize: 18, cursor: item.isAvailable ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: item.isAvailable ? 1 : 0.6,
          }}>+</button>
        </div>
        <div style={{
          display: 'inline-block', marginTop: 8,
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px',
          color: MUTED, background: '#F5EDE0', padding: '2px 8px', borderRadius: 6,
        }}>{item.category}</div>
      </div>
    </div>
  );
}

function CartSidebar({ onCheckout }: { onCheckout: () => void }) {
  const cart = useCart();
  const DELIVERY_FEE = 15;
  const total = cart.subtotal + (cart.lines.length > 0 ? DELIVERY_FEE : 0);

  return (
    <aside style={{
      width: 320, background: '#fff', borderLeft: `1px solid ${BORDER}`,
      position: 'fixed', top: 64, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 50,
    }} className="cc-cart-sidebar">
      <div style={{ padding: '24px 24px 16px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, color: '#0F0D0A' }}>
          Your Order
        </div>
        <div style={{ fontSize: 12, color: MUTED }}>
          {cart.count > 0 ? `${cart.count} item${cart.count > 1 ? 's' : ''}` : 'Add items to get started'}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {cart.lines.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: 12 }}>
            <div style={{ fontSize: 48, opacity: 0.4 }}>🛒</div>
            <div style={{ fontSize: 14, color: MUTED }}>Your cart is empty.<br />Pick something delicious!</div>
          </div>
        ) : (
          cart.lines.map((line) => (
            <div key={line.menuItemId} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '12px 0', borderBottom: `1px solid ${BORDER}`,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10,
                background: CREAM, overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {line.imageUrl ? (
                  <img src={line.imageUrl} alt={line.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span style={{ fontSize: 22 }}>🍽️</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0F0D0A', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {line.name}
                </div>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{line.vendorName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => cart.setQty(line.menuItemId, line.qty - 1)} style={qtyBtnStyle}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{line.qty}</span>
                  <button onClick={() => cart.setQty(line.menuItemId, line.qty + 1)} style={qtyBtnStyle}>+</button>
                </div>
              </div>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 700, color: ORANGE, flexShrink: 0 }}>
                GHS {(Number(line.price) * line.qty).toFixed(0)}
              </div>
            </div>
          ))
        )}
      </div>

      {cart.lines.length > 0 && (
        <div style={{ padding: '16px 24px 24px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ marginBottom: 16 }}>
            <Row label="Subtotal" value={`GHS ${cart.subtotal.toFixed(0)}`} />
            <Row label="Delivery fee" value={`GHS ${DELIVERY_FEE}`} />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 17, fontWeight: 800,
              color: '#0F0D0A', paddingTop: 10, borderTop: `1px solid ${BORDER}`, marginTop: 6,
            }}>
              <span>Total</span>
              <span style={{ color: ORANGE }}>GHS {total.toFixed(0)}</span>
            </div>
          </div>
          <button onClick={onCheckout} style={{
            width: '100%', padding: 16,
            background: ORANGE, color: '#fff', border: 'none', borderRadius: 14,
            fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            Proceed to Checkout →
          </button>
          <p style={{ textAlign: 'center', fontSize: 11, color: MUTED, marginTop: 10 }}>
            Pay with MTN MoMo, Vodafone Cash or AirtelTigo
          </p>
        </div>
      )}
    </aside>
  );
}

const qtyBtnStyle: React.CSSProperties = {
  width: 24, height: 24, borderRadius: '50%',
  border: `1px solid ${BORDER}`, background: CREAM,
  fontSize: 14, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: TEXT, fontFamily: "'Inter', sans-serif",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, padding: '4px 0' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 18,
      padding: 36, textAlign: 'center', color: MUTED,
    }}>
      <div style={{ fontSize: 34, marginBottom: 14 }}>⚠️</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#0F0D0A', marginBottom: 8 }}>Unable to load data</p>
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  );
}

function NoVendors() {
  return (
    <div style={{ background: '#fff', border: `1px dashed ${BORDER}`, borderRadius: 18, padding: 48, textAlign: 'center', color: MUTED }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🏪</div>
      <p style={{ fontWeight: 700, color: '#0F0D0A', marginBottom: 6 }}>No vendors available</p>
      <p style={{ fontSize: 13 }}>The server might not be running, or no vendors have signed up yet.</p>
    </div>
  );
}

function NoItems({ vendorName }: { vendorName: string }) {
  return (
    <div style={{ background: '#fff', border: `1px dashed ${BORDER}`, borderRadius: 18, padding: 48, textAlign: 'center', color: MUTED }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
      <p style={{ fontWeight: 700, color: '#0F0D0A', marginBottom: 6 }}>No items yet</p>
      <p style={{ fontSize: 13 }}>{vendorName} hasn't added menu items yet.</p>
    </div>
  );
}
