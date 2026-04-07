import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CartItem } from '../types/cart';

export type { CartItem, CartExtra } from '../types/cart';

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_KEY = 'pr_cart_v3';

function normalizeCartItem(raw: Record<string, unknown>): CartItem {
  const qty = typeof raw.quantity === 'number' ? raw.quantity : 1;
  const addOns = Array.isArray(raw.addOns) ? raw.addOns : [];
  const drinks = Array.isArray(raw.drinks) ? raw.drinks : [];
  const id = String(raw.id ?? '');
  const productId = String(raw.productId ?? raw.id ?? '');
  const price = Number(raw.price);
  const basePrice =
    typeof raw.basePrice === 'number' ? raw.basePrice : price;

  return {
    id,
    productId,
    name: String(raw.name ?? ''),
    price: Number.isFinite(price) ? price : 0,
    basePrice: Number.isFinite(basePrice) ? basePrice : price,
    addOns: addOns as CartItem['addOns'],
    drinks: drinks as CartItem['drinks'],
    imageUrl: String(raw.imageUrl ?? ''),
    quantity: qty > 0 ? qty : 1,
    weight: raw.weight !== undefined ? String(raw.weight) : undefined,
  };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      if (!saved) {
        const legacy = localStorage.getItem('pr_cart_v2');
        if (legacy) {
          const parsed = JSON.parse(legacy) as Record<string, unknown>[];
          return parsed.map(x => normalizeCartItem(x as Record<string, unknown>));
        }
        return [];
      }
      const parsed = JSON.parse(saved) as Record<string, unknown>[];
      return parsed.map(x => normalizeCartItem(x as Record<string, unknown>));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      // localStorage lleno o no disponible
    }
  }, [items]);

  const addItem = (item: Omit<CartItem, 'quantity'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id));

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems(prev =>
      prev.map(i => (i.id === id ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
}
