import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { getStats, getOrders, seedProducts, formatCOP } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  TrendingUp, ShoppingBag, Package, CalendarCheck, FileText,
  DollarSign, Clock, CheckCircle, ChefHat, ArrowRight, Sparkles,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { motion } from 'motion/react';

interface Stats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  deliveredOrders: number;
  totalProducts: number;
  totalReservations: number;
  totalInvoices: number;
  monthlySales: { month: string; revenue: number }[];
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  customer: { name: string };
  total: number;
  createdAt: string;
}

const ETIQUETAS_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente',
  preparando: 'Preparando',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([getStats(), getOrders()]);
      setStats(s as Stats);
      setRecentOrders((o.orders || []).slice(0, 5));
    } catch (e) {
      console.error('Error en dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const data = await seedProducts();
      toast.success(data.message, {
        style: { background: '#141414', color: '#fff', border: '1px solid #C9A84C33' },
      });
      fetchData();
    } catch (e: any) {
      toast.error(`Error: ${e.message}`, { style: { background: '#141414', color: '#fff' } });
    } finally {
      setSeeding(false);
    }
  };

  const StatCard = ({
    icon: Icon, label, value, sub, color = 'gold',
  }: {
    icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; color?: string;
  }) => (
    <div className="bg-[#141414] border border-white/5 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            color === 'gold' ? 'bg-[#C9A84C]/10' :
            color === 'blue' ? 'bg-blue-500/10' :
            color === 'green' ? 'bg-green-500/10' : 'bg-orange-500/10'
          }`}
        >
          <Icon
            className={`w-5 h-5 ${
              color === 'gold' ? 'text-[#C9A84C]' :
              color === 'blue' ? 'text-blue-400' :
              color === 'green' ? 'text-green-400' : 'text-orange-400'
            }`}
          />
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">
        {loading ? <div className="h-7 w-20 bg-white/5 rounded animate-pulse" /> : value}
      </div>
      <div className="text-white/40 text-xs">{label}</div>
      {sub && (
        <div className={`text-xs mt-1 ${color === 'green' ? 'text-green-400' : 'text-[#C9A84C]'}`}>
          {sub}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Bienvenida */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Buenas{' '}
            {new Date().getHours() < 12 ? 'noches' : new Date().getHours() < 18 ? 'tardes' : 'noches'},{' '}
            {user?.name}! 👋
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Esto es lo que está pasando en Prime &amp; Rare hoy.
          </p>
        </div>
        {stats?.totalProducts === 0 && (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-[#0A0A0A] rounded-xl font-semibold text-sm hover:bg-[#D4AF37] transition-colors disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {seeding ? 'Cargando...' : 'Cargar Productos de Muestra'}
          </button>
        )}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          icon={DollarSign}
          label="Ingresos Totales"
          value={stats ? formatCOP(stats.totalRevenue) : ''}
          color="gold"
        />
        <StatCard
          icon={ShoppingBag}
          label="Total de Pedidos"
          value={stats?.totalOrders ?? ''}
          sub={stats ? `${stats.pendingOrders} pendientes` : ''}
          color="blue"
        />
        <StatCard
          icon={Package}
          label="Productos"
          value={stats?.totalProducts ?? ''}
          color="orange"
        />
        <StatCard
          icon={CalendarCheck}
          label="Reservas"
          value={stats?.totalReservations ?? ''}
          color="green"
        />
      </div>

      {/* Estado de Pedidos */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pendientes', value: stats?.pendingOrders ?? 0, icon: Clock, color: 'text-yellow-400 bg-yellow-400/10' },
          { label: 'Preparando', value: stats?.preparingOrders ?? 0, icon: ChefHat, color: 'text-blue-400 bg-blue-400/10' },
          { label: 'Entregados', value: stats?.deliveredOrders ?? 0, icon: CheckCircle, color: 'text-green-400 bg-green-400/10' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.split(' ')[1]}`}>
              <Icon className={`w-5 h-5 ${color.split(' ')[0]}`} />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{loading ? '—' : value}</div>
              <div className="text-white/40 text-xs">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico + Acciones rápidas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Gráfico de Ingresos */}
        <div className="xl:col-span-2 bg-[#141414] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold">Resumen de Ingresos</h3>
            <div className="flex items-center gap-2 text-[#C9A84C]">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Últimos 6 meses</span>
            </div>
          </div>
          {stats?.monthlySales ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.monthlySales}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v =>
                    v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` :
                    v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`
                  }
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1A1A1A',
                    border: '1px solid rgba(201,168,76,0.2)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(v: number) => [formatCOP(v), 'Ingresos']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#C9A84C"
                  strokeWidth={2}
                  fill="url(#goldGrad)"
                  dot={{ fill: '#C9A84C', r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex items-center justify-center">
              <div className="text-white/20 text-sm">Sin datos de ingresos aún</div>
            </div>
          )}
        </div>

        {/* Acciones Rápidas */}
        <div className="bg-[#141414] border border-white/5 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-4">Acciones Rápidas</h3>
          <div className="space-y-3">
            {[
              { href: '/admin/products', label: 'Gestionar Productos', icon: Package },
              { href: '/admin/orders', label: 'Ver Pedidos', icon: ShoppingBag },
              { href: '/admin/invoices', label: 'Facturas', icon: FileText },
              { href: '/admin/reservations', label: 'Reservas', icon: CalendarCheck },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                to={href}
                className="flex items-center justify-between p-3 rounded-xl bg-[#1A1A1A] hover:bg-[#C9A84C]/10 hover:border-[#C9A84C]/20 border border-transparent transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-white/30 group-hover:text-[#C9A84C] transition-colors" />
                  <span className="text-white/60 text-sm group-hover:text-white transition-colors">
                    {label}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-[#C9A84C] transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Pedidos Recientes */}
      <div className="bg-[#141414] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-semibold">Pedidos Recientes</h3>
          <Link to="/admin/orders" className="text-[#C9A84C] text-xs hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">
            No hay pedidos aún
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-white/30 text-xs border-b border-white/5">
                  <th className="text-left pb-3">Pedido</th>
                  <th className="text-left pb-3">Cliente</th>
                  <th className="text-left pb-3">Estado</th>
                  <th className="text-left pb-3">Total</th>
                  <th className="text-left pb-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentOrders.map(order => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm"
                  >
                    <td className="py-3 text-[#C9A84C] font-medium">{order.orderNumber}</td>
                    <td className="py-3 text-white/70">{order.customer.name}</td>
                    <td className="py-3">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          order.status === 'entregado' ? 'bg-green-500/20 text-green-400' :
                          order.status === 'cancelado' ? 'bg-red-500/20 text-red-400' :
                          order.status === 'preparando' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        {ETIQUETAS_ESTADO[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="py-3 text-white">{formatCOP(order.total)}</td>
                    <td className="py-3 text-white/40 text-xs">
                      {new Date(order.createdAt).toLocaleDateString('es-CO')}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
