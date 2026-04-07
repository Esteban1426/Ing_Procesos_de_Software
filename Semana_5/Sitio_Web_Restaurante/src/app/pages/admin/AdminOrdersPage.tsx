import { useState, useEffect, useCallback } from 'react';
import { getOrders, updateOrderStatus, formatCOP } from '../../lib/api';
import {
  ShoppingBag, Search, ChevronDown, ChevronUp, RefreshCw,
  Clock, ChefHat, Package, CheckCircle, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import type { Order, OrderStatus } from '../../lib/localDB';

const ESTADOS = ['todos', 'pendiente', 'preparando', 'listo', 'entregado', 'cancelado'];

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendiente:  { label: 'Pendiente',   color: 'bg-yellow-500/20 text-yellow-400',  icon: Clock },
  preparando: { label: 'Preparando',  color: 'bg-blue-500/20 text-blue-400',      icon: ChefHat },
  listo:      { label: 'Listo',       color: 'bg-purple-500/20 text-purple-400',  icon: Package },
  entregado:  { label: 'Entregado',   color: 'bg-green-500/20 text-green-400',    icon: CheckCircle },
  cancelado:  { label: 'Cancelado',   color: 'bg-red-500/20 text-red-400',        icon: XCircle },
};

const SIGUIENTE_ESTADO: Record<string, OrderStatus[]> = {
  pendiente:  ['preparando', 'cancelado'],
  preparando: ['listo', 'cancelado'],
  listo:      ['entregado', 'cancelado'],
  entregado:  [],
  cancelado:  [],
};

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('todos');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getOrders();
      setOrders(data.orders || []);
    } catch (e) {
      console.error('Error cargando pedidos:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Auto-actualizar cada 30s
  useEffect(() => {
    const interval = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    setUpdating(orderId);
    try {
      await updateOrderStatus(orderId, status);
      toast.success(`Estado actualizado a: ${ESTADO_CONFIG[status]?.label ?? status}`, {
        style: { background: '#141414', color: '#fff', border: '1px solid #C9A84C33' },
      });
      fetchOrders(true);
    } catch (e: any) {
      toast.error(`Error: ${e.message}`, { style: { background: '#141414', color: '#fff' } });
    } finally {
      setUpdating(null);
    }
  };

  const filtered = orders
    .filter(o => filter === 'todos' || o.status === filter)
    .filter(
      o =>
        !search ||
        o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
        o.customer.name.toLowerCase().includes(search.toLowerCase()) ||
        o.customer.email.toLowerCase().includes(search.toLowerCase())
    );

  const counts = ESTADOS.reduce((acc, s) => {
    acc[s] = s === 'todos' ? orders.length : orders.filter(o => o.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Pedidos</h2>
          <p className="text-white/40 text-sm">{orders.length} pedidos en total</p>
        </div>
        <button
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[#141414] border border-white/10 text-white/60 rounded-xl text-sm hover:text-white transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Filtros de Estado */}
      <div className="flex flex-wrap gap-2">
        {ESTADOS.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === s
                ? 'bg-[#C9A84C] text-[#0A0A0A]'
                : 'bg-[#141414] border border-white/10 text-white/50 hover:text-white'
            }`}
          >
            <span className="capitalize">
              {s === 'todos' ? 'Todos' : ESTADO_CONFIG[s]?.label ?? s}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                filter === s ? 'bg-[#0A0A0A]/20 text-[#0A0A0A]' : 'bg-white/10 text-white/40'
              }`}
            >
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por # pedido, nombre o correo..."
          className="w-full bg-[#141414] border border-white/10 text-white placeholder-white/30 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
        />
      </div>

      {/* Lista de Pedidos */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#141414] rounded-2xl h-20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#141414] rounded-2xl border border-white/5">
          <ShoppingBag className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40">No se encontraron pedidos</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const cfg = ESTADO_CONFIG[order.status];
            const Icon = cfg?.icon || Clock;
            const isExpanded = expanded === order.id;
            const nextStatuses = SIGUIENTE_ESTADO[order.status] || [];

            return (
              <div
                key={order.id}
                className={`bg-[#141414] border rounded-2xl overflow-hidden transition-all ${
                  isExpanded ? 'border-[#C9A84C]/20' : 'border-white/5'
                }`}
              >
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : order.id)}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      cfg?.color.split(' ')[0] || 'bg-yellow-500/20'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${cfg?.color.split(' ')[1] || 'text-yellow-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[#C9A84C] font-bold text-sm">{order.orderNumber}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${cfg?.color}`}>
                        {cfg?.label ?? order.status}
                      </span>
                    </div>
                    <div className="text-white/50 text-xs mt-0.5">
                      {order.customer.name} · {order.items.length} artículo
                      {order.items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-white font-semibold">{formatCOP(order.total)}</div>
                    <div className="text-white/30 text-xs">
                      {new Date(order.createdAt).toLocaleDateString('es-CO')}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-white/30" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/30" />
                  )}
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-white/5 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Artículos */}
                          <div>
                            <h4 className="text-white/60 text-xs uppercase tracking-wider mb-3">
                              Artículos del Pedido
                            </h4>
                            <div className="space-y-2">
                              {order.items.map((item, i) => (
                                <div key={i} className="text-sm">
                                  <div className="flex justify-between gap-2">
                                    <span className="text-white/70">
                                      {item.name}{' '}
                                      <span className="text-white/30">×{item.quantity}</span>
                                    </span>
                                    <span className="text-white shrink-0">
                                      {formatCOP(item.price * item.quantity)}
                                    </span>
                                  </div>
                                  {(item.addOns?.length || item.drinks?.length) ? (
                                    <div className="text-white/30 text-xs mt-1 space-y-0.5">
                                      {item.addOns?.map(a => (
                                        <div key={a.id}>+ {a.name}</div>
                                      ))}
                                      {item.drinks?.map(d => (
                                        <div key={d.id}>Beb.: {d.name}</div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                              <div className="border-t border-white/5 pt-2 mt-2 space-y-1">
                                <div className="flex justify-between text-xs text-white/40">
                                  <span>Imp. al Consumo</span>
                                  <span>{formatCOP(order.tax)}</span>
                                </div>
                                {order.deliveryFee > 0 && (
                                  <div className="flex justify-between text-xs text-white/40">
                                    <span>Domicilio</span>
                                    <span>{formatCOP(order.deliveryFee)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm font-semibold">
                                  <span className="text-white">Total</span>
                                  <span className="text-[#C9A84C]">{formatCOP(order.total)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Cliente */}
                          <div>
                            <h4 className="text-white/60 text-xs uppercase tracking-wider mb-3">
                              Datos del Cliente
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-white/40">Nombre</span>
                                <span className="text-white">{order.customer.name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/40">Correo</span>
                                <span className="text-white/70 text-xs">{order.customer.email}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/40">Teléfono</span>
                                <span className="text-white/70">{order.customer.phone}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/40">Entrega</span>
                                <span className="text-white capitalize">
                                  {order.deliveryMethod === 'domicilio' ? 'Domicilio' : 'Recoger'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/40">Pago</span>
                                <span className="text-white capitalize">{order.paymentMethod}</span>
                              </div>
                              {order.customer.address && (
                                <div className="flex justify-between">
                                  <span className="text-white/40">Dirección</span>
                                  <span className="text-white/70 text-xs text-right max-w-[60%]">
                                    {order.customer.address}
                                  </span>
                                </div>
                              )}
                              {order.notes && (
                                <div>
                                  <span className="text-white/40 text-xs">Notas: </span>
                                  <span className="text-white/60 text-xs">{order.notes}</span>
                                </div>
                              )}
                            </div>

                            {/* Acciones de Estado */}
                            {nextStatuses.length > 0 && (
                              <div className="mt-4">
                                <h4 className="text-white/60 text-xs uppercase tracking-wider mb-3">
                                  Actualizar Estado
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {nextStatuses.map(s => (
                                    <button
                                      key={s}
                                      onClick={() => handleStatusUpdate(order.id, s)}
                                      disabled={updating === order.id}
                                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 ${
                                        s === 'cancelado'
                                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                          : 'bg-[#C9A84C] text-[#0A0A0A] hover:bg-[#D4AF37]'
                                      }`}
                                    >
                                      {updating === order.id
                                        ? '...'
                                        : `Marcar como ${ESTADO_CONFIG[s]?.label ?? s}`}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
