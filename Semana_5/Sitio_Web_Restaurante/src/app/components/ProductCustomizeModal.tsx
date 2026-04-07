import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, ShoppingCart } from 'lucide-react';
import { formatCOP } from '../lib/api';
import {
  MENU_ADD_ONS,
  MENU_DRINKS,
  buildCartItemFromProduct,
  computeUnitPrice,
} from '../lib/menuExtras';
import type { Product } from '../lib/localDB';
import type { CartExtra } from '../types/cart';

type Props = {
  product: Product;
  onClose: () => void;
  onAdd: (item: ReturnType<typeof buildCartItemFromProduct>) => void;
};

export function ProductCustomizeModal({ product, onClose, onAdd }: Props) {
  const [addOns, setAddOns] = useState<Set<string>>(new Set());
  const [drinks, setDrinks] = useState<Set<string>>(new Set());

  useEffect(() => {
    setAddOns(new Set());
    setDrinks(new Set());
  }, [product.id]);

  const selectedAddOns: CartExtra[] = MENU_ADD_ONS.filter(a => addOns.has(a.id));
  const selectedDrinks: CartExtra[] = MENU_DRINKS.filter(d => drinks.has(d.id));
  const unitTotal = computeUnitPrice(
    product.price,
    selectedAddOns,
    selectedDrinks
  );

  const toggle = (id: string, which: 'addOns' | 'drinks') => {
    if (which === 'addOns') {
      setAddOns(prev => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
    } else {
      setDrinks(prev => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
    }
  };

  const handleAdd = () => {
    onAdd(buildCartItemFromProduct(product, selectedAddOns, selectedDrinks));
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="bg-[#141414] border border-[#C9A84C]/25 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl shadow-black/50"
          onClick={e => e.stopPropagation()}
        >
          <div className="relative h-40 sm:h-44 overflow-hidden rounded-t-2xl">
            <img
              src={product.imageUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent" />
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-[#0A0A0A]/80 flex items-center justify-center text-white/70 hover:text-white hover:bg-[#0A0A0A] transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <p className="text-[#C9A84C] text-[10px] tracking-[0.25em] uppercase font-medium mb-1">
                Personalizar
              </p>
              <h3 className="text-white font-semibold text-lg leading-tight">
                {product.name}
              </h3>
              {product.weight && (
                <p className="text-white/35 text-xs mt-1">{product.weight}</p>
              )}
            </div>

            <div>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-3">
                Acompañamientos
              </p>
              <div className="flex flex-wrap gap-2">
                {MENU_ADD_ONS.map(a => {
                  const on = addOns.has(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggle(a.id, 'addOns')}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                        on
                          ? 'border-[#C9A84C] bg-[#C9A84C]/15 text-[#C9A84C]'
                          : 'border-white/10 text-white/50 hover:border-white/25'
                      }`}
                    >
                      {a.name}
                      <span className="text-white/35 ml-1">+{formatCOP(a.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-white/50 text-xs uppercase tracking-wider mb-3">
                Bebidas
              </p>
              <div className="flex flex-wrap gap-2">
                {MENU_DRINKS.map(d => {
                  const on = drinks.has(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggle(d.id, 'drinks')}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                        on
                          ? 'border-[#C9A84C] bg-[#C9A84C]/15 text-[#C9A84C]'
                          : 'border-white/10 text-white/50 hover:border-white/25'
                      }`}
                    >
                      {d.name}
                      <span className="text-white/35 ml-1">+{formatCOP(d.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <span className="text-white/50 text-sm">Total unidad</span>
              <span className="text-[#C9A84C] font-bold text-lg">
                {formatCOP(unitTotal)}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border border-white/10 text-white/60 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!product.inStock}
                className="flex-1 py-3 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-xl text-sm hover:bg-[#D4AF37] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" />
                Añadir al carrito
              </button>
            </div>
          </div>
        </motion.div>
    </motion.div>
  );
}
