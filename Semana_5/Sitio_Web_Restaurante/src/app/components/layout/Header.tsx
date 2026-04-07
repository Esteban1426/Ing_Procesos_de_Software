import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { ShoppingCart, Menu, X, ChefHat } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { motion, AnimatePresence } from 'motion/react';

export function Header() {
  const { totalItems } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  const navLinks = [
    { href: '/', label: 'Inicio' },
    { href: '/menu', label: 'Menú' },
    { href: '/reservations', label: 'Reservar' },
    { href: '/track', label: 'Rastrear Pedido' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0A0A0A]/95 backdrop-blur-md shadow-2xl border-b border-[#C9A84C]/10'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-[#C9A84C] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <ChefHat className="w-5 h-5 text-[#0A0A0A]" />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-none tracking-wide">
                Prime <span className="text-[#C9A84C]">&amp;</span> Rare
              </div>
              <div className="text-[#C9A84C]/60 text-[10px] tracking-[0.2em] uppercase">
                Asador Premium
              </div>
            </div>
          </Link>

          {/* Nav Desktop */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className={`text-sm tracking-wider transition-colors duration-200 ${
                  location.pathname === href
                    ? 'text-[#C9A84C]'
                    : 'text-white/70 hover:text-[#C9A84C]'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Acciones */}
          <div className="flex items-center gap-4">
            <Link
              to="/cart"
              className="relative p-2 text-white/80 hover:text-[#C9A84C] transition-colors"
              aria-label="Carrito"
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#C9A84C] text-[#0A0A0A] text-xs font-bold rounded-full flex items-center justify-center">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Link>
            <Link
              to="/menu"
              className="hidden md:block px-5 py-2 bg-[#C9A84C] text-[#0A0A0A] text-sm font-bold rounded-full hover:bg-[#D4AF37] transition-colors"
            >
              Pedir Ahora
            </Link>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden text-white"
              aria-label="Menú de navegación"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menú Móvil */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-[#0A0A0A]/98 backdrop-blur-md border-t border-[#C9A84C]/10"
          >
            <div className="px-4 py-6 space-y-4">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  to={href}
                  className="block text-white/80 hover:text-[#C9A84C] text-lg py-2 border-b border-white/5 transition-colors"
                >
                  {label}
                </Link>
              ))}
              <Link
                to="/menu"
                className="block mt-4 text-center px-6 py-3 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-full"
              >
                Pedir Ahora
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
