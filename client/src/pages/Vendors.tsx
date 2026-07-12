import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../lib/api';

const ORANGE = '#F4521E';
const CREAM = '#FDF6EC';
const TEXT = '#2B2720';
const MUTED = '#8A7E75';
const BORDER = 'rgba(43,39,32,0.09)';

interface Vendor {
  id: string;
  storeName: string;
  description: string;
  location: string;
  imageUrl?: string | null;
  isOpen: boolean;
  rating: number;
  cuisine: string[];
}

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open'>('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/vendors', {}, false);
        if (!res.ok) {
          setErr('Could not load vendors. Is the server running?');
          return;
        }
        setVendors(await res.json());
      } catch {
        setErr('Network error. Is the server running?');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return vendors.filter((v) => {
      if (filter === 'open' && !v.isOpen) return false;
      if (q && !v.storeName.toLowerCase().includes(q) && !v.cuisine.some((c) => c.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [vendors, query, filter]);

  return (
    <div style={{ background: CREAM, minHeight: '100vh', color: TEXT, fontFamily: "'Inter', sans-serif", overflowX: 'hidden' }}>
      <Navbar variant="cream" />

      {/* Hero */}
      <div style={{ padding: '110px 5% 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(244,82,30,0.09)', border: '1px solid rgba(244,82,30,0.2)',
              color: ORANGE, fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 1.5,
              padding: '5px 14px', borderRadius: 999, marginBottom: 16,
            }}>🪪 UMaT, Tarkwa · {vendors.length} Vendors</div>
            <h1 style={{
              fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 'clamp(36px, 5.5vw, 64px)',
              fontWeight: 800, letterSpacing: -2, color: '#0F0D0A', lineHeight: 1.0, marginBottom: 10,
            }}>
              All your <em style={{ fontStyle: 'normal', color: ORANGE }}>favourite</em><br />spots. One place.
            </h1>
            <p style={{ fontSize: 16, color: MUTED, maxWidth: 440, lineHeight: 1.65 }}>
              Browse every vendor on campus. See who's open, check menus, and order instantly.
            </p>
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 17, color: '#C4B8AE' }}>🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vendors…"
              style={{
                width: '100%', padding: '13px 16px 13px 48px',
                border: `1.5px solid ${BORDER}`, borderRadius: 999,
                background: '#fff', color: TEXT, fontSize: 14,
                fontFamily: "'Inter', sans-serif", outline: 'none',
                boxShadow: '0 2px 20px rgba(43,39,32,0.07)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, padding: '0 5% 32px', maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <Pill active={filter === 'all'} onClick={() => setFilter('all')}>All Vendors</Pill>
          <Pill active={filter === 'open'} onClick={() => setFilter('open')}>🟢 Open Now</Pill>
        </div>
        <div style={{ fontSize: 13, color: MUTED }}>
          Showing <strong style={{ color: '#1A7A3C', fontWeight: 700 }}>{filtered.length}</strong> vendors
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: '0 5% 80px', maxWidth: 1200, margin: '0 auto' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: MUTED, padding: 40 }}>Loading vendors…</p>
        ) : err ? (
          <ErrorPanel message={err} />
        ) : filtered.length === 0 && vendors.length > 0 ? (
          <NoResults />
        ) : filtered.length === 0 ? (
          <EmptyVendors />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {filtered.map((v) => <VendorCard key={v.id} vendor={v} />)}
            <BecomeVendorCard />
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px', borderRadius: 999,
      border: `1px solid ${active ? ORANGE : BORDER}`,
      background: active ? ORANGE : '#fff',
      fontSize: 13, fontWeight: 500,
      color: active ? '#fff' : MUTED, cursor: 'pointer',
      fontFamily: "'Inter', sans-serif", transition: 'all 0.18s',
    }}>{children}</button>
  );
}

function VendorCard({ vendor }: { vendor: Vendor }) {
  const initials = vendor.storeName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#E53E3E', '#D97706', '#0D9488', '#7C3AED', '#BE185D', '#1A7A3C', '#3B82F6', '#9333EA'];
  const color = colors[vendor.id.charCodeAt(0) % colors.length];

  return (
    <Link to={`/menu?vendorId=${vendor.id}`} style={{
      background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 24, overflow: 'hidden',
      boxShadow: '0 2px 20px rgba(43,39,32,0.07)', textDecoration: 'none', color: 'inherit', display: 'block',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(43,39,32,0.14)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 20px rgba(43,39,32,0.07)'; }}
    >
      <div style={{
        height: 180, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 68,
      }}>
        {vendor.imageUrl ? (
          <img
            src={vendor.imageUrl}
            alt={vendor.storeName}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>🍽️</span>
          </div>
        )}
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          padding: '5px 12px', borderRadius: 999,
          fontSize: 11, fontWeight: 700, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: vendor.isOpen ? '#4ADE80' : '#F87171' }} />
          {vendor.isOpen ? 'Open Now' : 'Closed'}
        </div>
        <div style={{
          position: 'absolute', bottom: 14, left: 14,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
          padding: '5px 12px', borderRadius: 999,
          fontSize: 12, fontWeight: 700, color: '#F9C13A',
        }}>★ {vendor.rating.toFixed(1)}</div>
      </div>
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 17, color: '#fff',
            flexShrink: 0, marginTop: -34, position: 'relative', zIndex: 1,
            border: '3px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            background: color,
          }}>{initials}</div>
          <div style={{ flex: 1, paddingTop: 4 }}>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, color: '#0F0D0A', letterSpacing: '-0.5px', marginBottom: 2 }}>
              {vendor.storeName}
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>📍 {vendor.location}</div>
          </div>
        </div>
        {vendor.cuisine.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
            {vendor.cuisine.slice(0, 4).map((c) => (
              <span key={c} style={{
                padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: '#F5EDE0', color: MUTED,
              }}>{c}</span>
            ))}
          </div>
        )}
        <div style={{
          display: 'block', width: '100%', padding: 12,
          background: vendor.isOpen ? ORANGE : '#C4B8AE', color: '#fff',
          borderRadius: 12, fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: 14, fontWeight: 800, textAlign: 'center',
        }}>
          {vendor.isOpen ? `Order from ${vendor.storeName} →` : 'Currently Closed'}
        </div>
      </div>
    </Link>
  );
}

function BecomeVendorCard() {
  return (
    <div style={{
      background: '#0F0D0A', borderRadius: 24, padding: '36px 28px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      minHeight: 340, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', bottom: -80, right: -80, width: 220, height: 220,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(244,82,30,0.3), transparent 70%)',
      }} />
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: ORANGE, fontWeight: 700, marginBottom: 12 }}>For Food Sellers</div>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.8px', marginBottom: 10, lineHeight: 1.2 }}>
        Sell more.<br />Stress less.
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 22, lineHeight: 1.65 }}>
        Join CampusChoo and reach hundreds of hungry students daily.
      </div>
      <Link to="/account?redirect=/portal" style={{
        padding: '13px 24px', background: ORANGE, color: '#fff',
        borderRadius: 999, fontFamily: "'Bricolage Grotesque', sans-serif",
        fontSize: 14, fontWeight: 800, textDecoration: 'none',
        display: 'inline-block', width: 'fit-content',
      }}>Register as a Vendor →</Link>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 24,
      padding: 40, textAlign: 'center', color: MUTED,
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <p style={{ color: '#0F0D0A', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Couldn't load vendors</p>
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  );
}

function EmptyVendors() {
  return (
    <div style={{ background: '#fff', border: `1px dashed ${BORDER}`, borderRadius: 24, padding: 60, textAlign: 'center', color: MUTED }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>🏪</div>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: '#0F0D0A', marginBottom: 6 }}>No vendors yet</div>
      <div style={{ fontSize: 14 }}>Be the first — register as a vendor!</div>
    </div>
  );
}

function NoResults() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: MUTED, gridColumn: '1/-1' }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>🔍</div>
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 800, color: '#0F0D0A', marginBottom: 6 }}>No vendors found</div>
      <div style={{ fontSize: 14 }}>Try a different search or filter.</div>
    </div>
  );
}
