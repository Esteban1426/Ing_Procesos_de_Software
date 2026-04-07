import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { getOrder, formatCOP } from '../lib/api';
import { Search, Package, ChefHat, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import type { Order } from '../lib/localDB';
import { validateOrderTrackingInput } from '../lib/validation';

const PASOS_ESTADO = [
  { key: 'pendiente', label: 'Pedido Recibido', icon: Package, desc: 'Recibimos tu pedido' },
  { key: 'preparando', label: 'En Preparación', icon: ChefHat, desc: 'Nuestros chefs están trabajando' },
  { key: 'listo', label: 'Listo', icon: Clock, desc: 'Tu pedido está listo' },
  { key: 'entregado', label: 'Entregado', icon: CheckCircle, desc: '¡Buen provecho!' },
];

const INDICE_ESTADO: Record<string, number> = {
  pendiente: 0,
  preparando: 1,
  listo: 2,
  entregado: 3,
};

const ETIQUETAS_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente',
  preparando: 'Preparando',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export function OrderTrackingPage() {
  const [searchParams] = useSearchParams();
  const idFromUrl = searchParams.get('id');
  const [inputId, setInputId] = useState(idFromUrl || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    const err = validateOrderTrackingInput(inputId);
    if (err) {
      setError(err);
      setOrder(null);
      return;
    }
    const id = inputId.trim();
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const data = await getOrder(id);
      setOrder(data.order);
    } catch {
      setError('Pedido no encontrado. Verifica el ID de seguimiento.');
    } finally {
      setLoading(false);
    }
  }, [inputId]);

  useEffect(() => {
    const fromUrl = idFromUrl?.trim();
    if (!fromUrl) return;
    setInputId(fromUrl);
    setLoading(true);
    setError('');
    setOrder(null);
    getOrder(fromUrl)
      .then(d => setOrder(d.order))
      .catch(() =>
        setError('Pedido no encontrado. Verifica el ID de seguimiento.')
      )
      .finally(() => setLoading(false));
  }, [idFromUrl]);

  const currentStep = order ? (INDICE_ESTADO[order.status] ?? 0) : -1;
  const isCancelled = order?.status === 'cancelado';

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <div className="text-[#C9A84C] text-xs tracking-[0.3em] uppercase mb-3 font-medium">
            Seguimiento
          </div>
          <h1 className="text-4xl font-bold text-white">Estado del Pedido</h1>
        </div>

        {/* Búsqueda */}
        <div className="flex gap-3 mb-12">
          <input
            value={inputId}
            onChange={e => setInputId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Ingresa el ID de tu pedido..."
            className="flex-1 bg-[#141414] border border-white/10 text-white placeholder-white/30 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-[#C9A84C]/50"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-3.5 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#D4AF37] transition-colors disabled:opacity-60 flex items-center gap-2 text-sm"
          >
            <Search className="w-4 h-4" /> {loading ? '...' : 'Buscar'}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center mb-8">
            <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {order && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Encabezado del Pedido */}
            <div className="bg-[#141414] border border-[#C9A84C]/20 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-white font-bold text-lg">{order.orderNumber}</h2>
                  <p className="text-white/35 text-[11px] font-mono mt-1 break-all">
                    ID de seguimiento: {order.id}
                  </p>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    order.status === 'entregado'
                      ? 'bg-green-500/20 text-green-400'
                      : order.status === 'cancelado'
                      ? 'bg-red-500/20 text-red-400'
                      : order.status === 'preparando'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-[#C9A84C]/20 text-[#C9A84C]'
                  }`}
                >
                  {ETIQUETAS_ESTADO[order.status] ?? order.status}
                </span>
              </div>
              <p className="text-white/40 text-xs">
                Pedido el{' '}
                {new Date(order.createdAt).toLocaleDateString('es-CO', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {/* Barra de Progreso */}
            {!isCancelled && (
              <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 mb-6">
                <h3 className="text-white font-semibold text-sm mb-6">Progreso del Pedido</h3>
                <div className="relative">
                  <div className="absolute top-5 left-5 right-5 h-0.5 bg-white/5" />
                  <div
                    className="absolute top-5 left-5 h-0.5 bg-[#C9A84C] transition-all duration-700"
                    style={{
                      width:
                        currentStep === 0
                          ? '0%'
                          : `${(currentStep / (PASOS_ESTADO.length - 1)) * 100}%`,
                    }}
                  />
                  <div className="relative flex justify-between">
                    {PASOS_ESTADO.map((s, i) => {
                      const Icon = s.icon;
                      const done = i <= currentStep;
                      const active = i === currentStep;
                      return (
                        <div
                          key={s.key}
                          className="flex flex-col items-center gap-2"
                          style={{ width: '25%' }}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all z-10 ${
                              done
                                ? 'border-[#C9A84C] bg-[#C9A84C]'
                                : 'border-white/10 bg-[#141414]'
                            } ${active ? 'shadow-lg shadow-[#C9A84C]/30' : ''}`}
                          >
                            <Icon
                              className={`w-4 h-4 ${done ? 'text-[#0A0A0A]' : 'text-white/20'}`}
                            />
                          </div>
                          <div className="text-center">
                            <p
                              className={`text-xs font-medium ${
                                done ? 'text-white' : 'text-white/30'
                              }`}
                            >
                              {s.label}
                            </p>
                            {active && (
                              <p className="text-[#C9A84C] text-[10px] mt-0.5">{s.desc}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Artículos del Pedido */}
            <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 mb-6">
              <h3 className="text-white font-semibold text-sm mb-4">Artículos del Pedido</h3>
              <div className="space-y-3">
                {order.items.map((item, i) => (
                  <div key={i} className="text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-white/60">
                        {item.name}{' '}
                        <span className="text-white/30">×{item.quantity}</span>
                      </span>
                      <span className="text-white shrink-0">
                        {formatCOP(item.price * item.quantity)}
                      </span>
                    </div>
                    {(item.addOns?.length || item.drinks?.length) ? (
                      <div className="text-white/25 text-[10px] mt-1 pl-0 space-y-0.5">
                        {item.addOns && item.addOns.length > 0 && (
                          <p>+ {item.addOns.map(a => a.name).join(', ')}</p>
                        )}
                        {item.drinks && item.drinks.length > 0 && (
                          <p>Beb.: {item.drinks.map(d => d.name).join(', ')}</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="border-t border-white/5 mt-4 pt-4 space-y-2">
                <div className="flex justify-between text-xs text-white/40">
                  <span>Subtotal</span>
                  <span>{formatCOP(order.subtotal)}</span>
                </div>
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
                <div className="flex justify-between font-semibold border-t border-white/5 pt-2">
                  <span className="text-white text-sm">Total</span>
                  <span className="text-[#C9A84C]">{formatCOP(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Datos de Entrega */}
            <div className="bg-[#141414] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-semibold text-sm mb-4">Datos de Entrega</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Nombre</span>
                  <span className="text-white">{order.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Método</span>
                  <span className="text-white capitalize">
                    {order.deliveryMethod === 'domicilio' ? 'Domicilio' : 'Recoger en Tienda'}
                  </span>
                </div>
                {order.customer.address && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Dirección</span>
                    <span className="text-white text-right max-w-[60%]">
                      {order.customer.address}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/40">Pago</span>
                  <span className="text-white capitalize">{order.paymentMethod}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {!order && !loading && !error && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-[#141414] rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-9 h-9 text-white/10" />
            </div>
            <p className="text-white/30 text-sm">
              Ingresa el ID de tu pedido para ver su estado
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
