import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface CartLine {
  menuItemId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  vendorId: string;
  vendorName: string;
  qty: number;
}

interface CartCtx {
  lines: CartLine[];
  vendorId: string | null;
  add: (item: Omit<CartLine, 'qty'>) => { ok: boolean; message?: string };
  setQty: (menuItemId: string, qty: number) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const STORAGE_KEY = 'cc_cart';
const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  // Single-vendor cart: enforce all lines belong to one vendor.
  const vendorId = lines[0]?.vendorId ?? null;

  function add(item: Omit<CartLine, 'qty'>) {
    if (vendorId && vendorId !== item.vendorId) {
      return { ok: false, message: 'You already have items from another vendor. Clear cart first.' };
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.menuItemId);
      if (existing) return prev.map((l) => l.menuItemId === item.menuItemId ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { ...item, qty: 1 }];
    });
    return { ok: true };
  }

  function setQty(menuItemId: string, qty: number) {
    setLines((prev) => qty <= 0
      ? prev.filter((l) => l.menuItemId !== menuItemId)
      : prev.map((l) => l.menuItemId === menuItemId ? { ...l, qty } : l));
  }

  function remove(menuItemId: string) { setQty(menuItemId, 0); }
  function clear() { setLines([]); }

  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.qty * Number(l.price), 0);

  return (
    <CartContext.Provider value={{ lines, vendorId, add, setQty, remove, clear, count, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartCtx {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
