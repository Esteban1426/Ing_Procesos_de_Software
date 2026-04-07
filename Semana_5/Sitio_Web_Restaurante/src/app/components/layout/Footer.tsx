import { Link } from "react-router";
import {
  ChefHat,
  MapPin,
  Phone,
  Mail,
  Clock,
  Instagram,
  Facebook,
  Twitter,
} from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#0A0A0A] border-t border-[#C9A84C]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Marca */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-[#C9A84C] rounded-full flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-[#0A0A0A]" />
              </div>
              <div>
                <div className="text-white font-bold text-lg leading-none">
                  Prime{" "}
                  <span className="text-[#C9A84C]">&amp;</span>{" "}
                  Rare
                </div>
                <div className="text-[#C9A84C]/60 text-[10px] tracking-[0.2em] uppercase">
                  Asador Premium
                </div>
              </div>
            </div>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs mt-4">
              Donde los cortes excepcionales se encuentran con
              la maestría culinaria. Cada plato es una
              celebración de las mejores carnes del mundo.
            </p>
            <div className="flex gap-4 mt-6">
              {[Instagram, Facebook, Twitter].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 bg-white/5 rounded-full flex items-center justify-center text-white/40 hover:bg-[#C9A84C]/20 hover:text-[#C9A84C] transition-all"
                  aria-label="Red social"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Navegación */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-5">
              Navegación
            </h4>
            <ul className="space-y-3">
              {[
                { href: "/", label: "Inicio" },
                { href: "/menu", label: "Nuestro Menú" },
                { href: "/reservations", label: "Reservas" },
                { href: "/track", label: "Rastrear Pedido" },
                { href: "/cart", label: "Carrito" },
                { href: "/admin/login", label: "Admin" },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    to={href}
                    className="text-white/50 hover:text-[#C9A84C] text-sm transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-5">
              Contacto
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#C9A84C] mt-0.5 flex-shrink-0" />
                <span className="text-white/50 text-sm">
                  Cra. 7 #114-60, Bogotá, Colombia
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
                <a
                  href="tel:+5712345678"
                  className="text-white/50 hover:text-[#C9A84C] text-sm transition-colors"
                >
                  +57 (1) 234-5678
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
                <a
                  href="mailto:hola@primeandare.com"
                  className="text-white/50 hover:text-[#C9A84C] text-sm transition-colors"
                >
                  hola@primeandare.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#C9A84C] mt-0.5 flex-shrink-0" />
                <div className="text-white/50 text-sm">
                  <div>Lun–Jue: 12PM – 11PM</div>
                  <div>Vie–Dom: 12PM – Medianoche</div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-xs">
            © 2026 Prime &amp; Rare. Todos los derechos
            reservados.
          </p>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-white/30 hover:text-[#C9A84C] text-xs transition-colors"
            >
              Política de Privacidad
            </a>
            <a
              href="#"
              className="text-white/30 hover:text-[#C9A84C] text-xs transition-colors"
            >
              Términos de Servicio
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}