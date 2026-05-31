import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/authStore';
import { api } from '../lib/api';

const ORANGE = '#F4521E';
const BG = '#080706';
const CARD = '#0f0d0c';
const BORDER = '#1f1c1a';
const MUTED = '#9A8E85';

interface Vendor {
  id: string;
  storeName: string;
  isOpen: boolean;
}

interface Product {
  id: string;
  vendorId: string;
  name: string;
  description?: string | null;
  price: number | string;
  category: string;
  imageUrl?: string | null;
  images?: string[];
  videoUrl?: string | null;
  isAvailable: boolean;
}

type Toast = { id: number; msg: string; tone: 'info' | 'success' | 'error' };

interface ProductFormData {
  name: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  images: string[];
  videoUrl: string;
}

const CATEGORY_SUGGESTIONS = ['Mains', 'Sides', 'Drinks', 'Snacks', 'Desserts', 'Combos', 'Breakfast'];

export default function Products() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const pushToast = useCallback((msg: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  // ── Auth + bootstrap ────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/account?redirect=/products'); return; }
    if (user.role !== 'VENDOR' && user.role !== 'ADMIN') {
      setErr('Only vendors can list products.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const meRes = await api('/api/vendors/me');
        if (cancelled) return;
        if (!meRes.ok) {
          const body = await meRes.json().catch(() => ({}));
          setErr(body.message ?? 'Could not load vendor profile.');
          return;
        }
        const me: Vendor = await meRes.json();
        if (cancelled) return;
        setVendor(me);

        const pRes = await fetch(`/api/vendors/${me.id}/menu`);
        if (cancelled) return;
        if (pRes.ok) setProducts(await pRes.json());
      } catch {
        if (!cancelled) setErr('Network error. Is the server running?');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, navigate]);

  // ── Mutations ───────────────────────────────────────────────────────────
  async function addProduct(data: ProductFormData) {
    if (!vendor) return false;
    const res = await api(`/api/vendors/${vendor.id}/menu`, {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        description: data.description || undefined,
        price: Number(data.price),
        category: data.category,
        imageUrl: data.imageUrl || undefined,
        images: data.images.filter((u) => u.trim()),
        videoUrl: data.videoUrl || undefined,
      }),
    });
    if (res.ok) {
      const created: Product = await res.json();
      setProducts((p) => [...p, created]);
      pushToast(`✓ Added ${created.name}`, 'success');
      return true;
    }
    const body = await res.json().catch(() => ({}));
    pushToast(body.message ?? 'Could not add product', 'error');
    return false;
  }

  async function updateProduct(id: string, patch: Partial<Product>) {
    const res = await api(`/api/menu/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated: Product = await res.json();
      setProducts((p) => p.map((x) => x.id === id ? updated : x));
      return true;
    }
    pushToast('Could not update product', 'error');
    return false;
  }

  async function deleteProduct(p: Product) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const res = await api(`/api/menu/${p.id}`, { method: 'DELETE' });
    if (res.ok) {
      setProducts((arr) => arr.filter((x) => x.id !== p.id));
      pushToast(`Deleted ${p.name}`, 'info');
    } else {
      pushToast('Could not delete product', 'error');
    }
  }

  // ── Derived state ───────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => set.add(p.category));
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return products.filter((p) => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, activeCategory]);

  const stats = useMemo(() => ({
    total: products.length,
    available: products.filter((p) => p.isAvailable).length,
    hidden: products.filter((p) => !p.isAvailable).length,
  }), [products]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div style={fullCenter}>Loading products…</div>
    );
  }

  if (err) {
    return (
      <div style={fullCenter}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
          <p style={{ color: '#fca5a5', marginBottom: 24 }}>{err}</p>
          <Link to="/" style={ctaBtn}>Back home</Link>
        </div>
      </div>
    );
  }

  if (!vendor) return null;

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Top bar */}
      <header style={{
        borderBottom: `1px solid ${BORDER}`, padding: '1rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        position: 'sticky', top: 0, background: BG, zIndex: 20,
      }}>
        <Link to="/" style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '1.25rem',
          color: ORANGE, margin: 0, textDecoration: 'none',
        }}>CampusChoo</Link>
        <span style={{ color: '#666', fontSize: '0.8125rem', borderLeft: `1px solid ${BORDER}`, paddingLeft: '0.75rem' }}>
          Products
        </span>
        <Link to="/portal" style={{
          marginLeft: 'auto', background: 'transparent', color: '#888',
          border: `1px solid ${BORDER}`, borderRadius: '0.5rem',
          padding: '0.4375rem 0.875rem', fontSize: '0.8125rem',
          textDecoration: 'none', fontFamily: "'Inter', sans-serif",
        }}>← Back to Portal</Link>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: '#666', fontSize: '0.6875rem', margin: '0 0 0.25rem', letterSpacing: '0.1em', fontWeight: 600 }}>
            {vendor.storeName.toUpperCase()}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{
                fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '2rem',
                color: '#fff', margin: 0, letterSpacing: '-0.02em',
              }}>My Products</h1>
              <p style={{ color: MUTED, fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
                {stats.total} total · <span style={{ color: '#22c55e' }}>{stats.available} available</span>
                {stats.hidden > 0 && <> · <span style={{ color: '#666' }}>{stats.hidden} hidden</span></>}
              </p>
            </div>
            <button onClick={() => setShowAddForm(true)} style={{
              background: ORANGE, color: '#fff', border: 'none',
              borderRadius: '0.75rem', padding: '0.75rem 1.5rem',
              fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer',
              fontFamily: "'Bricolage Grotesque', sans-serif",
            }}>+ Add Product</button>
          </div>
        </div>

        {/* Search + category filter */}
        {products.length > 0 && (
          <div style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              style={{
                flex: '1 1 240px', minWidth: 200,
                background: CARD, border: `1.5px solid ${BORDER}`,
                borderRadius: '0.75rem', color: '#fff',
                padding: '0.6875rem 1rem', fontSize: '0.875rem',
                fontFamily: "'Inter', sans-serif", outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map((c) => (
                <button key={c} onClick={() => setActiveCategory(c)} style={{
                  padding: '0.4375rem 0.875rem', borderRadius: 999,
                  border: `1px solid ${activeCategory === c ? ORANGE : BORDER}`,
                  background: activeCategory === c ? ORANGE + '22' : 'transparent',
                  color: activeCategory === c ? ORANGE : MUTED,
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <AddProductForm
            onSubmit={async (data) => {
              const ok = await addProduct(data);
              if (ok) setShowAddForm(false);
              return ok;
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Products list */}
        {products.length === 0 ? (
          <EmptyState onAdd={() => setShowAddForm(true)} />
        ) : filtered.length === 0 ? (
          <div style={{
            background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '1rem',
            padding: '3rem 1rem', textAlign: 'center', color: MUTED,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
            <p>No products match your filter.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                isEditing={editingId === p.id}
                onStartEdit={() => setEditingId(p.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={async (patch) => {
                  const ok = await updateProduct(p.id, patch);
                  if (ok) {
                    setEditingId(null);
                    pushToast(`Updated ${patch.name ?? p.name}`, 'success');
                  }
                  return ok;
                }}
                onToggleAvailability={() => updateProduct(p.id, { isAvailable: !p.isAvailable })}
                onDelete={() => deleteProduct(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toasts */}
      <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 100, maxWidth: 'calc(100vw - 2rem)' }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: t.tone === 'error' ? '#1f0a0a' : t.tone === 'success' ? '#0a1f10' : CARD,
            border: `1px solid ${t.tone === 'error' ? '#7f1d1d' : t.tone === 'success' ? '#166534' : BORDER}`,
            color: t.tone === 'error' ? '#fca5a5' : t.tone === 'success' ? '#86efac' : '#e5e5e5',
            borderRadius: '0.625rem', padding: '0.75rem 1rem', fontSize: '0.875rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxWidth: 320,
          }}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProductCard({
  product, isEditing, onStartEdit, onCancelEdit, onSave, onToggleAvailability, onDelete,
}: {
  product: Product;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: Partial<Product>) => Promise<boolean>;
  onToggleAvailability: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<ProductFormData>({
    name: product.name,
    description: product.description ?? '',
    price: Number(product.price).toFixed(2),
    category: product.category,
    imageUrl: product.imageUrl ?? '',
    images: product.images ?? [],
    videoUrl: product.videoUrl ?? '',
  });
  const [saving, setSaving] = useState(false);

  // Reset draft if user cancels and product changes externally
  useEffect(() => {
    setDraft({
      name: product.name,
      description: product.description ?? '',
      price: Number(product.price).toFixed(2),
      category: product.category,
      imageUrl: product.imageUrl ?? '',
      images: product.images ?? [],
      videoUrl: product.videoUrl ?? '',
    });
  }, [product, isEditing]);

  if (isEditing) {
    return (
      <div style={{
        background: CARD, border: `1.5px solid ${ORANGE}`, borderRadius: '0.875rem',
        padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem',
      }}>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" style={editInput} />
        <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Description" rows={2} style={{ ...editInput, resize: 'vertical', minHeight: 50 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8 }}>
          <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} list="cc-cats" placeholder="Category" style={editInput} />
          <datalist id="cc-cats">
            {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
          <input type="number" step="0.01" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} style={editInput} />
        </div>
        <MediaFields
          imageUrl={draft.imageUrl}
          images={draft.images}
          videoUrl={draft.videoUrl}
          onChange={(patch) => setDraft({ ...draft, ...patch })}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancelEdit} style={ghostBtn}>Cancel</button>
          <button
            onClick={async () => {
              setSaving(true);
              await onSave({
                name: draft.name.trim(),
                description: draft.description.trim() || null,
                price: Number(draft.price),
                category: draft.category.trim(),
                imageUrl: draft.imageUrl.trim() || null,
                images: draft.images.map((u) => u.trim()).filter(Boolean),
                videoUrl: draft.videoUrl.trim() || null,
              });
              setSaving(false);
            }}
            disabled={saving || !draft.name.trim() || !draft.category.trim()}
            style={{ ...primaryBtn, padding: '0.5rem 1rem', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: '0.875rem',
      overflow: 'hidden', opacity: product.isAvailable ? 1 : 0.55,
    }}>
      <div style={{ position: 'relative' }}>
        {product.imageUrl ? (
          <div style={{ width: '100%', height: 130, background: '#1a1614', overflow: 'hidden' }}>
            <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <div style={{
            width: '100%', height: 130, background: 'linear-gradient(135deg, #1a1614, #0f0d0c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: '#3a3431',
          }}>🍽️</div>
        )}
        {/* Media badges (image count + video) */}
        {(product.images && product.images.length > 0) || product.videoUrl ? (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            display: 'flex', gap: 4,
          }}>
            {product.images && product.images.length > 0 && (
              <span style={{
                background: 'rgba(0,0,0,0.7)', color: '#fff',
                fontSize: '0.6875rem', fontWeight: 700,
                padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
                backdropFilter: 'blur(4px)',
              }}>
                📷 +{product.images.length}
              </span>
            )}
            {product.videoUrl && (
              <a
                href={product.videoUrl}
                target="_blank" rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'rgba(244,82,30,0.9)', color: '#fff',
                  fontSize: '0.6875rem', fontWeight: 700,
                  padding: '0.25rem 0.5rem', borderRadius: '0.375rem',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3,
                }}
              >
                ▶ VIDEO
              </a>
            )}
          </div>
        ) : null}
      </div>
      <div style={{ padding: '0.875rem 1rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
          <h3 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '0.9375rem',
            color: '#fff', margin: 0, letterSpacing: '-0.01em', wordBreak: 'break-word',
          }}>{product.name}</h3>
          <p style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '0.9375rem', color: ORANGE, flexShrink: 0 }}>
            GHS {Number(product.price).toFixed(2)}
          </p>
        </div>
        <p style={{
          margin: '0 0 0.625rem', color: MUTED, fontSize: '0.6875rem',
          textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
        }}>{product.category}</p>
        {product.description && (
          <p style={{ margin: '0 0 0.875rem', color: '#aaa', fontSize: '0.8125rem', lineHeight: 1.4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{product.description}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <button onClick={onToggleAvailability} style={{
            background: product.isAvailable ? '#0a1f10' : '#1a1614',
            border: `1px solid ${product.isAvailable ? '#22c55e44' : BORDER}`,
            color: product.isAvailable ? '#22c55e' : MUTED,
            borderRadius: '0.5rem', padding: '0.4375rem 0.625rem',
            fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: product.isAvailable ? '#22c55e' : '#666',
            }} />
            {product.isAvailable ? 'AVAILABLE' : 'HIDDEN'}
          </button>
          <button onClick={onStartEdit} style={{
            ...ghostBtn, padding: '0.4375rem 0.75rem', fontSize: '0.75rem', marginLeft: 'auto',
          }}>Edit</button>
          <button onClick={onDelete} aria-label="Delete" style={{
            background: 'transparent', border: `1px solid ${BORDER}`, color: '#888',
            borderRadius: '0.5rem', width: 30, height: 30, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontSize: '0.875rem',
          }}>✕</button>
        </div>
      </div>
    </div>
  );
}

function AddProductForm({
  onSubmit, onCancel,
}: {
  onSubmit: (data: ProductFormData) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ProductFormData>({
    name: '', description: '', price: '', category: '',
    imageUrl: '', images: [], videoUrl: '',
  });

  function update(patch: Partial<ProductFormData>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim() || !form.price) return;
    setSubmitting(true);
    const ok = await onSubmit(form);
    setSubmitting(false);
    if (ok) setForm({
      name: '', description: '', price: '', category: '',
      imageUrl: '', images: [], videoUrl: '',
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: CARD, border: `1.5px solid ${ORANGE}66`, borderRadius: '1rem',
      padding: '1.25rem', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>
      <h3 style={{ margin: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '1.0625rem', color: '#fff' }}>
        Add a new product
      </h3>
      <input placeholder="Product name *" value={form.name} onChange={(e) => update({ name: e.target.value })} required style={editInput} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
        <input
          placeholder="Category *" list="cc-cats-add"
          value={form.category} onChange={(e) => update({ category: e.target.value })}
          required style={editInput}
        />
        <datalist id="cc-cats-add">
          {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
        </datalist>
        <input
          type="number" step="0.01" min="0" placeholder="Price *"
          value={form.price} onChange={(e) => update({ price: e.target.value })}
          required style={editInput}
        />
      </div>
      <textarea
        placeholder="Description (optional)" rows={2}
        value={form.description} onChange={(e) => update({ description: e.target.value })}
        style={{ ...editInput, resize: 'vertical', minHeight: 50 }}
      />
      <MediaFields
        imageUrl={form.imageUrl}
        images={form.images}
        videoUrl={form.videoUrl}
        onChange={update}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Adding…' : 'List Product'}
        </button>
      </div>
    </form>
  );
}

// ─── MediaFields ─────────────────────────────────────────────────────────────
// Cover image, gallery images (multi), and a single video. Each input pair has
// a URL field AND a file picker that uploads to /api/upload and fills the URL.

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api('/api/upload', { method: 'POST', body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Upload failed');
  }
  const data = await res.json();
  return data.url as string;
}

function FilePickerButton({
  accept, label, onPicked,
}: {
  accept: string;
  label: string;
  onPicked: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadFile(file);
      onPicked(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      // Reset input so picking the same file again still fires onChange
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange}
        style={{ display: 'none' }} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          background: busy ? '#1a1614' : '#0f0d0c',
          border: `1px solid ${BORDER}`, color: busy ? MUTED : ORANGE,
          borderRadius: 8, padding: '0.4375rem 0.75rem',
          fontSize: '0.75rem', fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer', fontFamily: "'Inter', sans-serif",
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        {busy ? 'Uploading…' : label}
      </button>
    </>
  );
}

function MediaFields({
  imageUrl, images, videoUrl, onChange,
}: {
  imageUrl: string;
  images: string[];
  videoUrl: string;
  onChange: (patch: { imageUrl?: string; images?: string[]; videoUrl?: string }) => void;
}) {
  function setGallery(i: number, value: string) {
    const next = [...images];
    next[i] = value;
    onChange({ images: next });
  }
  function addGalleryUrl(value: string) { onChange({ images: [...images, value] }); }
  function removeGallery(i: number) { onChange({ images: images.filter((_, idx) => idx !== i) }); }

  const sectionLabel: React.CSSProperties = {
    color: MUTED, fontSize: '0.6875rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 6, display: 'block',
  };

  const isVideoFile = (url: string) => /\.(mp4|webm|ogg|mov)$/i.test(url) || url.startsWith('/uploads/');

  return (
    <div style={{
      background: '#0a0908', border: `1px solid ${BORDER}`,
      borderRadius: '0.625rem', padding: '0.875rem',
      display: 'flex', flexDirection: 'column', gap: '0.875rem',
    }}>
      {/* Cover image */}
      <div>
        <label style={sectionLabel}>📷 Cover image (optional)</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            placeholder="https://… or upload from your computer →"
            value={imageUrl}
            onChange={(e) => onChange({ imageUrl: e.target.value })}
            style={{ ...editInput, flex: 1 }}
          />
          <FilePickerButton accept="image/*" label="📎 Upload" onPicked={(url) => onChange({ imageUrl: url })} />
        </div>
        {imageUrl.trim() && (
          <img src={imageUrl} alt="" style={{
            marginTop: 8, width: '100%', maxHeight: 140, objectFit: 'cover',
            borderRadius: '0.375rem', background: '#1a1614',
          }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
      </div>

      {/* Additional gallery images */}
      <div>
        <label style={sectionLabel}>🖼 Additional images ({images.length})</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {images.map((url, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                placeholder={`Image ${i + 1} URL`}
                value={url}
                onChange={(e) => setGallery(i, e.target.value)}
                style={{ ...editInput, flex: 1 }}
              />
              {url.trim() && (
                <img src={url} alt="" style={{
                  width: 36, height: 36, objectFit: 'cover', borderRadius: 6,
                  background: '#1a1614', flexShrink: 0,
                }} onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
              )}
              <button type="button" onClick={() => removeGallery(i)} aria-label="Remove" style={{
                background: 'transparent', border: `1px solid ${BORDER}`, color: '#888',
                borderRadius: 6, width: 30, height: 30, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                fontSize: '0.875rem',
              }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button type="button" onClick={() => addGalleryUrl('')} style={{
            background: 'transparent', color: ORANGE,
            border: `1px dashed ${ORANGE}66`, borderRadius: 8,
            padding: '0.4375rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          }}>+ Add image URL</button>
          <FilePickerButton accept="image/*" label="📎 Upload image"
            onPicked={(url) => addGalleryUrl(url)} />
        </div>
      </div>

      {/* Video */}
      <div>
        <label style={sectionLabel}>🎬 Video (optional)</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            placeholder="YouTube/Vimeo URL or upload from computer →"
            value={videoUrl}
            onChange={(e) => onChange({ videoUrl: e.target.value })}
            style={{ ...editInput, flex: 1 }}
          />
          <FilePickerButton accept="video/*" label="📎 Upload" onPicked={(url) => onChange({ videoUrl: url })} />
        </div>
        {videoUrl.trim() && (
          <div style={{ marginTop: 8 }}>
            {isVideoFile(videoUrl) ? (
              <video src={videoUrl} controls style={{
                width: '100%', maxHeight: 200, borderRadius: '0.375rem',
                background: '#000',
              }} />
            ) : (
              <p style={{ margin: 0, color: MUTED, fontSize: '0.75rem' }}>
                ▶ <a href={videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE }}>Open video to verify</a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '1rem',
      padding: '4rem 1.5rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '3rem', opacity: 0.5, marginBottom: 12 }}>📋</div>
      <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: '1.25rem', color: '#fff', margin: '0 0 8px' }}>
        No products yet
      </h3>
      <p style={{ color: MUTED, fontSize: '0.875rem', margin: '0 0 24px', maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
        List your first product to start receiving orders. You can add as many as you like.
      </p>
      <button onClick={onAdd} style={primaryBtn}>+ List your first product</button>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const fullCenter: React.CSSProperties = {
  background: BG, minHeight: '100vh', color: '#888',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: "'Inter', sans-serif", padding: '2rem',
};

const editInput: React.CSSProperties = {
  width: '100%', background: '#0a0908', border: `1px solid ${BORDER}`,
  borderRadius: '0.5rem', color: '#fff', padding: '0.625rem 0.75rem',
  fontSize: '0.875rem', outline: 'none', fontFamily: "'Inter', sans-serif",
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  background: ORANGE, color: '#fff', border: 'none', borderRadius: '0.5rem',
  padding: '0.5rem 1.25rem', fontWeight: 700, cursor: 'pointer',
  fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '0.875rem',
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${BORDER}`, color: '#888',
  borderRadius: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer',
  fontFamily: "'Inter', sans-serif", fontSize: '0.875rem',
};

const ctaBtn: React.CSSProperties = {
  ...primaryBtn, padding: '0.75rem 1.5rem', textDecoration: 'none', display: 'inline-block',
};
