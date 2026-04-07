import { useState, type ChangeEvent } from 'react';
import { CalendarCheck, Users, Clock, CheckCircle } from 'lucide-react';
import { createReservation } from '../lib/api';
import {
  isValidEmail,
  sanitizeNotes,
  validatePersonName,
  validatePhone,
  validateReservationDate,
} from '../lib/validation';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { CheckoutField } from '../components/CheckoutField';
import { LabeledField } from '../components/LabeledField';

const HORARIOS = [
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '7:00 PM', '7:30 PM',
  '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM',
  '10:00 PM', '10:30 PM',
];

const OCASIONES = [
  'Ninguna', 'Cumpleaños', 'Aniversario', 'Reunión de Negocios',
  'Cita Romántica', 'Celebración Especial', 'Otra',
];

export function ReservationsPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', date: '',
    time: '', guests: '2', occasion: 'Ninguna', notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ resNumber: string } | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const validate = () => {
    const e: Record<string, string> = {};
    const nameErr = validatePersonName(form.name);
    if (nameErr) e.name = nameErr;
    if (!isValidEmail(form.email)) e.email = 'Se requiere un correo válido';
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) e.phone = phoneErr;
    const dateErr = validateReservationDate(form.date, today);
    if (dateErr) e.date = dateErr;
    if (!form.time) e.time = 'La hora es obligatoria';
    const g = parseInt(form.guests, 10);
    if (!form.guests || Number.isNaN(g) || g < 1)
      e.guests = 'Se requiere al menos 1 comensal';
    if (!Number.isNaN(g) && g > 20) e.guests = 'Máximo 20 comensales';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await createReservation({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        date: form.date,
        time: form.time,
        guests: parseInt(form.guests, 10),
        occasion: form.occasion,
        notes: sanitizeNotes(form.notes),
      });
      setSuccess({ resNumber: data.reservation.reservationNumber });
      toast.success('¡Reserva confirmada!', {
        style: { background: '#141414', color: '#fff', border: '1px solid #C9A84C33' },
      });
    } catch (e: any) {
      toast.error(`Error al reservar: ${e.message}`, {
        style: { background: '#141414', color: '#fff' },
      });
    } finally {
      setLoading(false);
    }
  };

  const onInput =
    (name: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [name]: e.target.value }));

  if (success) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] pt-20 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[#141414] border border-[#C9A84C]/20 rounded-3xl p-10 text-center"
        >
          <div className="w-20 h-20 bg-[#C9A84C]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-[#C9A84C]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">¡Reserva Confirmada!</h2>
          <p className="text-white/50 text-sm mb-6">
            Esperamos recibirte en Prime &amp; Rare. ¡Será una velada memorable!
          </p>
          <div className="bg-[#1A1A1A] rounded-2xl p-5 mb-6 text-left space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Reserva</span>
              <span className="text-[#C9A84C] font-bold">{success.resNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Fecha</span>
              <span className="text-white">
                {new Date(form.date + 'T12:00:00').toLocaleDateString('es-CO', {
                  weekday: 'short',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Hora</span>
              <span className="text-white">{form.time}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Comensales</span>
              <span className="text-white">{form.guests}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setSuccess(null);
              setForm({ name: '', email: '', phone: '', date: '', time: '', guests: '2', occasion: 'Ninguna', notes: '' });
            }}
            className="w-full py-3 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#D4AF37] transition-colors text-sm"
          >
            Hacer Otra Reserva
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-20">
      {/* Encabezado */}
      <div className="bg-[#0D0D0D] border-b border-white/5 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-[#C9A84C] text-xs tracking-[0.3em] uppercase mb-3 font-medium">
            Reserva tu Mesa
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white">Reserva Tu Velada</h1>
          <p className="text-white/40 mt-4 max-w-xl mx-auto text-sm">
            Asegura tu mesa en Prime &amp; Rare y déjanos crear una experiencia gastronómica
            que recordarás siempre.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        {/* Destacados */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { icon: CalendarCheck, label: 'Confirmación Inmediata' },
            { icon: Users, label: 'Grupos hasta 20 Personas' },
            { icon: Clock, label: '12PM – Medianoche' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="bg-[#141414] border border-white/5 rounded-2xl p-4 text-center"
            >
              <Icon className="w-5 h-5 text-[#C9A84C] mx-auto mb-2" />
              <p className="text-white/60 text-xs">{label}</p>
            </div>
          ))}
        </div>

        {/* Formulario */}
        <div className="bg-[#141414] border border-white/5 rounded-2xl p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <CheckoutField
              label="Nombre Completo"
              name="name"
              value={form.name}
              onChange={onInput('name')}
              error={errors.name}
              placeholder="Juan Pérez"
              required
            />
            <CheckoutField
              label="Correo Electrónico"
              name="email"
              type="email"
              value={form.email}
              onChange={onInput('email')}
              error={errors.email}
              placeholder="juan@ejemplo.com"
              required
            />
            <CheckoutField
              label="Teléfono / WhatsApp"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={onInput('phone')}
              error={errors.phone}
              placeholder="+57 300 123 4567"
              required
            />
            <LabeledField label="Número de Comensales" required error={errors.guests}>
              <select
                value={form.guests}
                onChange={e => setForm(f => ({ ...f, guests: e.target.value }))}
                className={`w-full bg-[#1A1A1A] border rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors ${
                  errors.guests ? 'border-red-500/50' : 'border-white/10 focus:border-[#C9A84C]/50'
                }`}
              >
                {[...Array(20)].map((_, i) => (
                  <option key={i + 1} value={i + 1} className="bg-[#1A1A1A]">
                    {i + 1} {i === 0 ? 'Comensal' : 'Comensales'}
                  </option>
                ))}
              </select>
            </LabeledField>
            <CheckoutField
              label="Fecha Preferida"
              name="date"
              type="date"
              value={form.date}
              onChange={onInput('date')}
              error={errors.date}
              min={today}
              required
            />
            <LabeledField label="Hora Preferida" required error={errors.time}>
              <select
                value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className={`w-full bg-[#1A1A1A] border rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors ${
                  errors.time ? 'border-red-500/50' : 'border-white/10 focus:border-[#C9A84C]/50'
                }`}
              >
                <option value="" className="bg-[#1A1A1A]">Selecciona una hora...</option>
                {HORARIOS.map(t => (
                  <option key={t} value={t} className="bg-[#1A1A1A]">{t}</option>
                ))}
              </select>
            </LabeledField>
          </div>

          <LabeledField label="Ocasión">
            <select
              value={form.occasion}
              onChange={e => setForm(f => ({ ...f, occasion: e.target.value }))}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9A84C]/50"
            >
              {OCASIONES.map(o => (
                <option key={o} value={o} className="bg-[#1A1A1A]">{o}</option>
              ))}
            </select>
          </LabeledField>

          <div>
            <label className="block text-white/60 text-xs mb-1.5">Solicitudes Especiales</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Restricciones alimentarias, alergias, preferencias de ubicación..."
              rows={3}
              maxLength={500}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50 resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#D4AF37] transition-colors text-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <CalendarCheck className="w-4 h-4" />
            {loading ? 'Confirmando...' : 'Confirmar Reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}
