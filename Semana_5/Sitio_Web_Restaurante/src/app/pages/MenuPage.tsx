import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, ShoppingCart, Search, SlidersHorizontal } from 'lucide-react';
import { getProducts, formatCOP } from '../lib/api';
import { useCart } from '../context/CartContext';
import { ProductCustomizeModal } from '../components/ProductCustomizeModal';
import { toast } from 'sonner';
import type { Product } from '../lib/localDB';

const CATEGORIAS = [
  { key: 'all', label: 'Todos' },
  { key: 'steaks', label: 'Cortes' },
  { key: 'ribs', label: 'Costillas' },
  { key: 'lamb', label: 'Cordero' },
  { key: 'burgers', label: 'Hamburguesas' },
  { key: 'sharing', label: 'Para Compartir' },
];

export function MenuPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const { addItem } = useCart();
  const [customizeProduct, setCustomizeProduct] = useState<Product | null>(null);

  useEffect(() => {
    setLoading(true);
    getProducts()
      .then(d => setProducts(d.products || []))
      .catch(e => console.error('Error cargando menú:', e))
      .finally(() => setLoading(false));
  }, []);

  const filtered = products
    .filter(p => category === 'all' || p.category === category)
    .filter(
      p =>
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });

  const handleOpenCustomize = (p: Product) => {
    if (!p.inStock) return;
    setCustomizeProduct(p);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-20">
      {/* Encabezado */}
      <div className="bg-[#0D0D0D] border-b border-white/5 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-[#C9A84C] text-xs tracking-[0.3em] uppercase mb-3 font-medium">
            Nuestra Selección
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">Cortes Premium y Más</h1>
          <p className="text-white/40 mt-4 max-w-xl mx-auto text-sm">
            Cada plato de nuestro menú representa la cúspide de la calidad. Explora nuestra
            selección y pide a domicilio o para recoger.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4 mb-10">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar en el menú..."
              className="w-full bg-[#141414] border border-white/10 text-white placeholder-white/30 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
            />
          </div>
          <div className="flex items-center gap-2 bg-[#141414] border border-white/10 rounded-xl px-4 py-3">
            <SlidersHorizontal className="w-4 h-4 text-white/30" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-transparent text-white text-sm focus:outline-none"
            >
              <option value="featured" className="bg-[#141414]">Destacados Primero</option>
              <option value="price-asc" className="bg-[#141414]">Precio: Menor a Mayor</option>
              <option value="price-desc" className="bg-[#141414]">Precio: Mayor a Menor</option>
              <option value="rating" className="bg-[#141414]">Mejor Calificados</option>
            </select>
          </div>
        </div>

        {/* Categorías */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIAS.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                category === cat.key
                  ? 'bg-[#C9A84C] text-[#0A0A0A]'
                  : 'bg-[#141414] text-white/50 hover:text-white border border-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grilla de Productos */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-[#141414] rounded-2xl overflow-hidden animate-pulse">
                <div className="h-56 bg-white/5" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-full" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-[#141414] rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-white/40 text-lg">No se encontraron productos</p>
            <p className="text-white/20 text-sm mt-2">
              Intenta ajustar tu búsqueda o filtro
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={category + search}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {filtered.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-[#141414] rounded-2xl overflow-hidden group border border-white/5 hover:border-[#C9A84C]/20 hover:shadow-xl hover:shadow-[#C9A84C]/5 transition-all duration-300"
                >
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414]/80 to-transparent" />
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#0A0A0A]/80 backdrop-blur-sm rounded-full px-2 py-1">
                      <Star className="w-3 h-3 text-[#C9A84C] fill-[#C9A84C]" />
                      <span className="text-white text-xs">{p.rating.toFixed(1)}</span>
                    </div>
                    {!p.inStock && (
                      <div className="absolute top-3 left-3 bg-red-500/80 rounded-full px-2 py-0.5">
                        <span className="text-white text-[10px] font-medium">Agotado</span>
                      </div>
                    )}
                    {p.featured && p.inStock && (
                      <div className="absolute top-3 left-3 bg-[#C9A84C]/20 border border-[#C9A84C]/40 rounded-full px-2 py-0.5">
                        <span className="text-[#C9A84C] text-[10px] font-medium">Destacado</span>
                      </div>
                    )}
                    {p.origin && (
                      <div className="absolute bottom-3 left-3">
                        <span className="text-white/60 text-[10px] bg-[#0A0A0A]/60 rounded-full px-2 py-0.5">
                          {p.origin}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-white font-semibold text-sm leading-tight">{p.name}</h3>
                      {p.weight && (
                        <span className="text-white/30 text-xs whitespace-nowrap">{p.weight}</span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs leading-relaxed mb-4 line-clamp-2">
                      {p.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[#C9A84C] font-bold text-base">{formatCOP(p.price)}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenCustomize(p)}
                        disabled={!p.inStock}
                        className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] text-[#0A0A0A] text-xs font-bold rounded-full hover:bg-[#D4AF37] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ShoppingCart className="w-3 h-3" /> Agregar
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {customizeProduct && (
        <ProductCustomizeModal
          product={customizeProduct}
          onClose={() => setCustomizeProduct(null)}
          onAdd={item => {
            addItem(item);
            toast.success(`¡${customizeProduct.name} agregado al carrito!`, {
              style: {
                background: '#141414',
                color: '#fff',
                border: '1px solid #C9A84C33',
              },
            });
          }}
        />
      )}
    </div>
  );
}
