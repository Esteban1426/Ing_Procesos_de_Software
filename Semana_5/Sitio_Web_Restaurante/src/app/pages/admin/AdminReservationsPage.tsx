import { useState, useEffect, useCallback } from 'react';
import { getReservations, updateReservationStatus } from '../../lib/api';
import {
  CalendarCheck, Search, Users, Clock, Check, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import type { Reservation, ReservationStatus } from '../../lib/localDB';

const ESTADO_CONFIG: Record<string, { color: string; label: string }> = {
  confirmada:  { color: 'bg-green-500/20 text-green-400',  label: 'Confirmada' },
  cancelada:   { color: 'bg-red-500/20 text-red-400',      label: 'Cancelada' },
  completada:  { color: 'bg-blue-500/20 text-blue-400',    label: 'Completada' },
};

export function AdminReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getReservations();
      setReservations(d.reservations || []);
    } catch (e) {
      console.error('Error cargando reservas:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  const handleStatusUpdate = async (id: string, status: ReservationStatus) => {
    setUpdating(id);
    try {
      await updateReservationStatus(id, status);
      toast.success(`Reserva ${ESTADO_CONFIG[status]?.label ?? status}`, {
        style: { background: '#141414', color: '#fff', border: '1px solid #C9A84C33' },
      });
      fetchReservations();
    } catch (e: any) {
      toast.error(`Error: ${e.message}`, { style: { background: '#141414', color: '#fff' } });
    } finally {
      setUpdating(null);
    }
  };

  const filtered = reservations
    .filter(r => filter === 'todos' || r.status === filter)
    .filter(
      r =>
        !search ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.reservationNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.email.toLowerCase().includes(search.toLowerCase())
    );

  const upcoming = reservations.filter(
    r => new Date(r.date + 'T12:00:00') >= new Date() && r.status === 'confirmada'
  ).length;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h2 className="text-xl font-bold text-white">Reservas</h2>
        <p className="text-white/40 text-sm">
          {upcoming} próximas · {reservations.length} en total
        </p>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: reservations.length, color: 'text-white' },
          {
            label: 'Confirmadas',
            value: reservations.filter(r => r.status === 'confirmada').length,
            color: 'text-green-400',
          },
          { label: 'Próximas', value: upcoming, color: 'text-[#C9A84C]' },
          {
            label: 'Canceladas',
            value: reservations.filter(r => r.status === 'cancelada').length,
            color: 'text-red-400',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#141414] border border-white/5 rounded-2xl p-5">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-white/40 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, correo o # reserva..."
            className="w-full bg-[#141414] border border-white/10 text-white placeholder-white/30 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['todos', 'confirmada', 'completada', 'cancelada'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === s
                  ? 'bg-[#C9A84C] text-[#0A0A0A]'
                  : 'bg-[#141414] border border-white/10 text-white/50 hover:text-white'
              }`}
            >
              {s === 'todos' ? 'Todos' : ESTADO_CONFIG[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#141414] rounded-2xl h-16 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#141414] rounded-2xl border border-white/5">
          <CalendarCheck className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40">No se encontraron reservas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(res => {
            const cfg = ESTADO_CONFIG[res.status] ?? ESTADO_CONFIG.confirmada;
            const isExpanded = expanded === res.id;
            const resDate = new Date(res.date + 'T12:00:00');
            const isPast = resDate < new Date();

            return (
              <div
                key={res.id}
                className={`bg-[#141414] border rounded-2xl overflow-hidden transition-all ${
                  isExpanded ? 'border-[#C9A84C]/20' : 'border-white/5'
                }`}
              >
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : res.id)}
                >
                  <div className="w-12 h-12 bg-[#C9A84C]/10 rounded-2xl flex flex-col items-center justify-center flex-shrink-0">
                    <div className="text-[#C9A84C] font-bold text-sm leading-none">
                      {resDate.getDate()}
                    </div>
                    <div className="text-[#C9A84C]/60 text-[10px] uppercase">
                      {resDate.toLocaleString('es-CO', { month: 'short' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-white font-semibold text-sm">{res.name}</span>
                      <span className="text-[#C9A84C] text-xs">{res.reservationNumber}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {isPast && res.status === 'confirmada' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                          Pasada
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-white/40 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {res.time}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {res.guests}{' '}
                        {res.guests === 1 ? 'comensal' : 'comensales'}
                      </div>
                      {res.occasion && res.occasion !== 'Ninguna' && (
                        <div className="text-[#C9A84C]/60">{res.occasion}</div>
                      )}
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
                          <div>
                            <h4 className="text-white/60 text-xs uppercase tracking-wider mb-3">
                              Datos del Comensal
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-white/40">Nombre</span>
                                <span className="text-white">{res.name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/40">Correo</span>
                                <span className="text-white/70 text-xs">{res.email}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/40">Teléfono</span>
                                <span className="text-white/70">{res.phone}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-white/40">Comensales</span>
                                <span className="text-white">{res.guests}</span>
                              </div>
                              {res.occasion && res.occasion !== 'Ninguna' && (
                                <div className="flex justify-between">
                                  <span className="text-white/40">Ocasión</span>
                                  <span className="text-white">{res.occasion}</span>
                                </div>
                              )}
                              {res.notes && (
                                <div>
                                  <span className="text-white/40 text-xs">Notas: </span>
                                  <span className="text-white/60 text-xs">{res.notes}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-white/60 text-xs uppercase tracking-wider mb-3">
                              Actualizar Estado
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {res.status !== 'completada' && (
                                <button
                                  onClick={() => handleStatusUpdate(res.id, 'completada')}
                                  disabled={updating === res.id}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-green-500/20 text-green-400 rounded-xl text-xs font-semibold hover:bg-green-500/30 transition-colors disabled:opacity-60"
                                >
                                  <Check className="w-3 h-3" /> Marcar Completada
                                </button>
                              )}
                              {res.status !== 'cancelada' && (
                                <button
                                  onClick={() => handleStatusUpdate(res.id, 'cancelada')}
                                  disabled={updating === res.id}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-60"
                                >
                                  <X className="w-3 h-3" /> Cancelar
                                </button>
                              )}
                              {res.status === 'cancelada' && (
                                <button
                                  onClick={() => handleStatusUpdate(res.id, 'confirmada')}
                                  disabled={updating === res.id}
                                  className="flex items-center gap-1.5 px-4 py-2 bg-[#C9A84C] text-[#0A0A0A] rounded-xl text-xs font-semibold hover:bg-[#D4AF37] transition-colors disabled:opacity-60"
                                >
                                  <Check className="w-3 h-3" /> Reactivar
                                </button>
                              )}
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/5">
                              <div className="text-white/40 text-xs">
                                Reservada el{' '}
                                {new Date(res.createdAt).toLocaleDateString('es-CO', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                })}
                              </div>
                            </div>
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
