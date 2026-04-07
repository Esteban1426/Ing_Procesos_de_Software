import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  Star, ArrowRight, ChevronDown, Award, Leaf, Globe,
  Clock, ShoppingCart, CalendarCheck,
} from 'lucide-react';
import { getProducts, formatCOP } from '../lib/api';
import { useCart } from '../context/CartContext';
import { ProductCustomizeModal } from '../components/ProductCustomizeModal';
import { toast } from 'sonner';
import type { Product } from '../lib/localDB';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1766832255363-c9f060ade8b0?w=1600&q=85';
const WAGYU_IMAGE = 'https://images.unsplash.com/photo-1690983320937-ca293f1d1d97?w=900&q=85';

const testimonios = [
  {
    name: 'Santiago R.',
    role: 'Crítico Gastronómico',
    text: 'El Wagyu A5 de Prime & Rare es la mejor carne que he probado en Colombia. De nivel mundial.',
    stars: 5,
  },
  {
    name: 'Valentina M.',
    role: 'Cliente Habitual',
    text: 'Cada visita es una experiencia única. El Tomahawk es un espectáculo y el servicio es impecable.',
    stars: 5,
  },
  {
    name: 'Andrés B.',
    role: 'Chef Ejecutivo',
    text: 'Como cocinero soy muy exigente. Prime & Rare consigue ingredientes a un nivel que me humilla.',
    stars: 5,
  },
];

const caracteristicas = [
  {
    icon: Award,
    title: 'Selección Premium',
    desc: 'Solo cortes de calidad A de las granjas más reputadas del mundo.',
  },
  {
    icon: Globe,
    title: 'Origen Global',
    desc: 'Wagyu de Japón, Angus de Argentina, Cordero de Nueva Zelanda y más.',
  },
  {
    icon: Leaf,
    title: 'Fuente Sostenible',
    desc: 'Trabajamos exclusivamente con fincas comprometidas con prácticas éticas y sostenibles.',
  },
  {
    icon: Clock,
    title: 'Maduración Perfecta',
    desc: 'Nuestros cortes se maduran en seco durante un mínimo de 28 días.',
  },
];

export function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const { addItem } = useCart();
  const [customizeProduct, setCustomizeProduct] = useState<Product | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoadingProducts(true);
    getProducts()
      .then(d => {
        const prods = (d.products || []).filter(p => p.featured).slice(0, 4);
        setFeatured(prods);
      })
      .catch(e => console.error('Error cargando productos destacados:', e))
      .finally(() => setLoadingProducts(false));
  }, []);

  return (
    <div className="text-white">
      {/* ── Hero ── */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="Prime & Rare steakhouse"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/70 via-[#0A0A0A]/50 to-[#0A0A0A]" />
        </div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-full px-5 py-2 mb-8">
              <span className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-pulse" />
              <span className="text-[#C9A84C] text-xs tracking-[0.2em] uppercase font-medium">
                La Mejor Parrilla de Bogotá
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-none tracking-tight mb-6">
              Creado para<br />
              <span className="text-[#C9A84C]">Verdaderos Carnívoros</span>
            </h1>
            <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
              Cada corte es seleccionado con una obsesión meticulosa. Cada plato preparado con
              una habilidad sin concesiones. Bienvenido a Prime &amp; Rare.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-full hover:bg-[#D4AF37] transition-all hover:scale-105 text-sm tracking-wide"
              >
                <ShoppingCart className="w-4 h-4" /> Ver Menú
              </Link>
              <Link
                to="/reservations"
                className="inline-flex items-center gap-2 px-8 py-4 border border-white/20 text-white rounded-full hover:bg-white/5 transition-all text-sm tracking-wide"
              >
                <CalendarCheck className="w-4 h-4" /> Reservar Mesa
              </Link>
            </div>
          </motion.div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/30" />
        </div>
      </section>

      {/* ── Características ── */}
      <section className="py-24 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {caracteristicas.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center p-6"
              >
                <div className="w-12 h-12 bg-[#C9A84C]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-[#C9A84C]" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
                <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Productos Destacados ── */}
      <section className="py-24 bg-[#0D0D0D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-16">
            <div>
              <div className="text-[#C9A84C] text-xs tracking-[0.3em] uppercase mb-3 font-medium">
                Selección Exclusiva
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
                Cortes Destacados
              </h2>
            </div>
            <Link
              to="/menu"
              className="hidden md:flex items-center gap-2 text-[#C9A84C] text-sm hover:gap-3 transition-all"
            >
              Menú Completo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingProducts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featured.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-[#141414] rounded-2xl overflow-hidden group hover:shadow-2xl hover:shadow-[#C9A84C]/10 transition-all duration-300 border border-white/5 hover:border-[#C9A84C]/20"
                >
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] to-transparent opacity-60" />
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#0A0A0A]/80 rounded-full px-2 py-1">
                      <Star className="w-3 h-3 text-[#C9A84C] fill-[#C9A84C]" />
                      <span className="text-white text-xs">{p.rating.toFixed(1)}</span>
                    </div>
                    {p.origin && (
                      <div className="absolute top-3 left-3 bg-[#C9A84C]/20 border border-[#C9A84C]/30 rounded-full px-2 py-0.5">
                        <span className="text-[#C9A84C] text-[10px] font-medium">{p.origin}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-white font-semibold text-sm mb-1">{p.name}</h3>
                    <p className="text-white/40 text-xs leading-relaxed mb-4 line-clamp-2">
                      {p.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[#C9A84C] font-bold text-base">
                          {formatCOP(p.price)}
                        </span>
                        {p.weight && (
                          <span className="text-white/30 text-xs ml-1">/ {p.weight}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => p.inStock && setCustomizeProduct(p)}
                        disabled={!p.inStock}
                        className="w-9 h-9 bg-[#C9A84C] rounded-full flex items-center justify-center hover:bg-[#D4AF37] transition-colors disabled:opacity-40"
                        title="Agregar al carrito"
                      >
                        <ShoppingCart className="w-4 h-4 text-[#0A0A0A]" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="text-center mt-12">
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 px-8 py-3 border border-[#C9A84C]/30 text-[#C9A84C] rounded-full hover:bg-[#C9A84C]/10 transition-all text-sm"
            >
              Ver Menú Completo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Historia ── */}
      <section className="py-24 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="aspect-[4/3] rounded-3xl overflow-hidden">
                <img src={WAGYU_IMAGE} alt="Wagyu beef" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-[#141414] border border-[#C9A84C]/20 rounded-2xl p-5 shadow-2xl">
                <div className="text-3xl font-bold text-[#C9A84C]">A5</div>
                <div className="text-white/60 text-xs mt-1">Grado Wagyu</div>
                <div className="flex gap-1 mt-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-[#C9A84C] text-[#C9A84C]" />
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="text-[#C9A84C] text-xs tracking-[0.3em] uppercase mb-4 font-medium">
                Nuestra Historia
              </div>
              <h2 className="text-4xl font-bold text-white leading-tight mb-6">
                El Arte del<br />Corte Perfecto
              </h2>
              <p className="text-white/50 leading-relaxed mb-6">
                Creemos que la carne excepcional merece un cuidado excepcional. Por eso visitamos
                personalmente cada finca de la que nos proveemos, construyendo relaciones que
                garantizan la calidad que sabores en cada bocado.
              </p>
              <p className="text-white/50 leading-relaxed mb-8">
                Desde las colinas de Hyogo en Japón hasta las pampas de Argentina, solo
                seleccionamos los mejores cortes, madurados y preparados con técnicas refinadas
                durante décadas.
              </p>
              <div className="grid grid-cols-3 gap-6 mb-8">
                {[
                  { num: '28+', label: 'Días de Maduración' },
                  { num: '15+', label: 'Granjas Aliadas' },
                  { num: '50K+', label: 'Comensales Felices' },
                ].map(({ num, label }) => (
                  <div
                    key={label}
                    className="text-center p-4 bg-[#141414] rounded-2xl border border-white/5"
                  >
                    <div className="text-2xl font-bold text-[#C9A84C]">{num}</div>
                    <div className="text-white/40 text-xs mt-1">{label}</div>
                  </div>
                ))}
              </div>
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 px-7 py-3 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-full hover:bg-[#D4AF37] transition-all text-sm"
              >
                Explorar Nuestro Menú <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Testimonios ── */}
      <section className="py-24 bg-[#0D0D0D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="text-[#C9A84C] text-xs tracking-[0.3em] uppercase mb-3 font-medium">
              Lo Que Dicen Nuestros Comensales
            </div>
            <h2 className="text-4xl font-bold text-white">Experiencias Inolvidables</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonios.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                viewport={{ once: true }}
                className="bg-[#141414] border border-white/5 rounded-2xl p-8 hover:border-[#C9A84C]/20 transition-all"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(t.stars)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-[#C9A84C] text-[#C9A84C]" />
                  ))}
                </div>
                <p className="text-white/70 leading-relaxed mb-6 text-sm italic">
                  "{t.text}"
                </p>
                <div>
                  <div className="text-white font-semibold text-sm">{t.name}</div>
                  <div className="text-[#C9A84C]/60 text-xs">{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-[#C9A84C]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A0A0A] mb-4">
            ¿Listo para una Velada Inolvidable?
          </h2>
          <p className="text-[#0A0A0A]/60 mb-8">
            Reserva tu mesa ahora y déjanos crear una experiencia gastronómica que nunca olvidarás.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/reservations"
              className="px-8 py-3 bg-[#0A0A0A] text-white font-bold rounded-full hover:bg-[#141414] transition-colors text-sm"
            >
              Hacer una Reserva
            </Link>
            <Link
              to="/menu"
              className="px-8 py-3 border-2 border-[#0A0A0A] text-[#0A0A0A] font-bold rounded-full hover:bg-[#0A0A0A]/10 transition-colors text-sm"
            >
              Ver Menú
            </Link>
          </div>
        </div>
      </section>

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
