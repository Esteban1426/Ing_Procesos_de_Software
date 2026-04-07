import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard, Package, ShoppingBag, FileText, CalendarCheck,
  LogOut, Menu, X, ChefHat, Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

const navItems = [
  { href: '/admin', label: 'Panel de Control', icon: LayoutDashboard },
  { href: '/admin/products', label: 'Productos', icon: Package },
  { href: '/admin/orders', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/invoices', label: 'Facturas', icon: FileText },
  { href: '/admin/reservations', label: 'Reservas', icon: CalendarCheck },
];

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Sesión cerrada', { style: { background: '#141414', color: '#fff' } });
    navigate('/admin/login');
  };

  const currentLabel =
    navItems.find(
      n => n.href === location.pathname || (n.href !== '/admin' && location.pathname.startsWith(n.href))
    )?.label ?? 'Panel de Control';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/5">
        <div className="w-9 h-9 bg-[#C9A84C] rounded-lg flex items-center justify-center">
          <ChefHat className="w-5 h-5 text-[#0A0A0A]" />
        </div>
        <div>
          <div className="text-white font-bold text-sm leading-tight">
            Prime <span className="text-[#C9A84C]">&amp;</span> Rare
          </div>
          <div className="text-white/40 text-[10px] tracking-wider">ADMINISTRACIÓN</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            location.pathname === href ||
            (href !== '/admin' && location.pathname.startsWith(href));
          return (
            <Link
              key={href}
              to={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-[#C9A84C] text-[#0A0A0A]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Usuario */}
      <div className="px-3 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 mb-2">
          <div className="w-8 h-8 bg-[#C9A84C]/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-[#C9A84C] text-sm font-bold">
              {user?.name?.[0] ?? 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">
              {user?.name ?? 'Administrador'}
            </div>
            <div className="text-white/40 text-xs truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/50 hover:text-red-400 hover:bg-red-400/10 w-full text-sm transition-all"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#141414] border-r border-white/5 fixed left-0 top-0 bottom-0">
        <SidebarContent />
      </aside>

      {/* Sidebar Móvil */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 bg-[#141414] border-r border-white/5 flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Contenido Principal */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Barra Superior */}
        <header className="h-16 bg-[#141414] border-b border-white/5 flex items-center justify-between px-6 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-white/60 hover:text-white"
            aria-label="Abrir menú"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1 lg:flex-none">
            <h1 className="text-white font-semibold text-sm lg:text-base">{currentLabel}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-white/40 hover:text-[#C9A84C] text-xs transition-colors"
            >
              Ver Sitio →
            </Link>
            <button
              className="text-white/40 hover:text-white relative"
              aria-label="Notificaciones"
            >
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Contenido de Página */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
