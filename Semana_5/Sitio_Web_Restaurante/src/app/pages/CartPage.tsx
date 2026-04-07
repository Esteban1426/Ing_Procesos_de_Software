import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import {
  Trash2, Plus, Minus, ShoppingBag, ArrowLeft, ArrowRight, CheckCircle, Download,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { createOrder, formatCOP } from '../lib/api';
import { downloadInvoiceHtml } from '../lib/invoiceDownload';
import { DELIVERY_FEE, TAX_RATE } from '../lib/localDB';
import type { Invoice } from '../lib/localDB';
import {
  isValidEmail,
  sanitizeNotes,
  validatePersonName,
  validatePhone,
} from '../lib/validation';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { CheckoutField } from '../components/CheckoutField';

type Step = 'cart' | 'checkout' | 'confirmation';

interface OrderResult {
  orderNumber: string;
  id: string;
  total: number;
  invoice: Invoice;
}

export function CartPage() {
  const { items, removeItem, updateQuantity, clearCart, subtotal } = useCart();
  const [step, setStep] = useState<Step>('cart');
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    deliveryMethod: 'domicilio' as 'domicilio' | 'recoger',
    paymentMethod: 'efectivo',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tax = Math.round(subtotal * TAX_RATE);
  const deliveryFee = form.deliveryMethod === 'domicilio' ? DELIVERY_FEE : 0;
  const total = subtotal + tax + deliveryFee;

  const validate = () => {
    const e: Record<string, string> = {};
    const nameErr = validatePersonName(form.name);
    if (nameErr) e.name = nameErr;
    if (!isValidEmail(form.email)) e.email = 'Se requiere un correo válido';
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) e.phone = phoneErr;
    if (form.deliveryMethod === 'domicilio' && !form.address.trim())
      e.address = 'La dirección de domicilio es obligatoria';
    else if (form.address.trim().length > 200)
      e.address = 'La dirección no puede superar 200 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await createOrder({
        customer: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        },
        items: items.map(i => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          imageUrl: i.imageUrl,
          addOns: i.addOns.length ? i.addOns : undefined,
          drinks: i.drinks.length ? i.drinks : undefined,
        })),
        deliveryMethod: form.deliveryMethod,
        paymentMethod: form.paymentMethod,
        notes: sanitizeNotes(form.notes),
      });
      setOrderResult({
        orderNumber: data.order.orderNumber,
        id: data.order.id,
        total: data.order.total,
        invoice: data.invoice,
      });
      clearCart();
      setStep('confirmation');
    } catch (e: any) {
      toast.error(`Error al realizar el pedido: ${e.message}`, {
        style: { background: '#141414', color: '#fff' },
      });
      console.error('Error en pedido:', e);
    } finally {
      setLoading(false);
    }
  };

  const onFormChange =
    (name: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [name]: e.target.value }));

  if (step === 'confirmation' && orderResult) {
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
          <h2 className="text-2xl font-bold text-white mb-2">¡Pedido Realizado!</h2>
          <p className="text-white/50 text-sm mb-6">
            Tu pedido ha sido recibido y está siendo procesado.
          </p>
          <div className="bg-[#1A1A1A] rounded-2xl p-5 mb-6 text-left space-y-3">
            <div className="flex justify-between text-sm gap-3">
              <span className="text-white/50 shrink-0">Número de Pedido</span>
              <span className="text-[#C9A84C] font-bold text-right">{orderResult.orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm gap-3">
              <span className="text-white/50 shrink-0">ID de seguimiento</span>
              <span className="text-white/90 font-mono text-xs text-right break-all">
                {orderResult.id}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Total Pagado</span>
              <span className="text-white font-semibold">{formatCOP(orderResult.total)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              to={`/track?id=${orderResult.id}`}
              className="w-full py-3 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#D4AF37] transition-colors text-sm"
            >
              Rastrear mi Pedido
            </Link>
            <button
              type="button"
              onClick={() => downloadInvoiceHtml(orderResult.invoice)}
              className="w-full py-3 border border-[#C9A84C]/40 text-[#C9A84C] rounded-xl hover:bg-[#C9A84C]/10 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Descargar factura
            </button>
            <Link
              to="/menu"
              className="w-full py-3 border border-white/10 text-white/60 rounded-xl hover:bg-white/5 transition-colors text-sm"
            >
              Seguir Comprando
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Pasos */}
        <div className="flex items-center gap-4 mb-10">
          {(['cart', 'checkout'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-4">
              <div
                className={`flex items-center gap-2 ${
                  step === s ? 'text-[#C9A84C]' : s === 'cart' && step === 'checkout' ? 'text-white/40' : 'text-white/20'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                    step === s
                      ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                      : 'border-white/10 text-white/30'
                  }`}
                >
                  {i + 1}
                </div>
                <span className="text-sm font-medium">
                  {s === 'cart' ? 'Tu Carrito' : 'Datos de Entrega'}
                </span>
              </div>
              {i < 1 && <div className="h-px w-8 bg-white/10" />}
            </div>
          ))}
        </div>

        {items.length === 0 && step === 'cart' ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 bg-[#141414] rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-9 h-9 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Tu carrito está vacío</h2>
            <p className="text-white/40 mb-8 text-sm">
              Descubre nuestra selección premium y agrega algunos cortes a tu carrito.
            </p>
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-full hover:bg-[#D4AF37] transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Ver Menú
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Principal */}
            <div className="lg:col-span-2">
              <AnimatePresence>
                {step === 'cart' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="space-y-4">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex gap-4"
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-20 h-20 object-cover rounded-xl flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-semibold text-sm mb-0.5">
                              {item.name}
                            </h3>
                            {item.weight && (
                              <p className="text-white/30 text-xs mb-1">{item.weight}</p>
                            )}
                            {(item.addOns.length > 0 || item.drinks.length > 0) && (
                              <div className="text-white/35 text-[11px] space-y-0.5 mb-2">
                                {item.addOns.length > 0 && (
                                  <p>
                                    <span className="text-white/45">+ </span>
                                    {item.addOns.map(a => a.name).join(', ')}
                                  </p>
                                )}
                                {item.drinks.length > 0 && (
                                  <p>
                                    <span className="text-white/45">Beb.: </span>
                                    {item.drinks.map(d => d.name).join(', ')}
                                  </p>
                                )}
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="w-7 h-7 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white/60 hover:bg-[#C9A84C] hover:text-[#0A0A0A] transition-all"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-white text-sm w-4 text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="w-7 h-7 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white/60 hover:bg-[#C9A84C] hover:text-[#0A0A0A] transition-all"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-[#C9A84C] font-bold text-sm">
                                  {formatCOP(item.price * item.quantity)}
                                </span>
                                <button
                                  onClick={() => removeItem(item.id)}
                                  className="text-white/20 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-6">
                      <Link
                        to="/menu"
                        className="flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> Seguir Comprando
                      </Link>
                      <button
                        onClick={() => setStep('checkout')}
                        className="flex items-center gap-2 px-6 py-3 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#D4AF37] transition-colors text-sm"
                      >
                        Continuar al Pago <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 'checkout' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-5">
                      <h2 className="text-white font-semibold text-lg">Datos de Entrega</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <CheckoutField
                          label="Nombre Completo"
                          name="name"
                          value={form.name}
                          onChange={onFormChange('name')}
                          error={errors.name}
                          placeholder="Juan Pérez"
                          required
                        />
                        <CheckoutField
                          label="Correo Electrónico"
                          name="email"
                          type="email"
                          value={form.email}
                          onChange={onFormChange('email')}
                          error={errors.email}
                          placeholder="juan@ejemplo.com"
                          required
                        />
                        <CheckoutField
                          label="Teléfono / WhatsApp"
                          name="phone"
                          type="tel"
                          value={form.phone}
                          onChange={onFormChange('phone')}
                          error={errors.phone}
                          placeholder="+57 300 123 4567"
                          required
                        />
                        <div>
                          <label className="block text-white/60 text-xs mb-1.5">
                            Método de Entrega *
                          </label>
                          <select
                            value={form.deliveryMethod}
                            onChange={e =>
                              setForm(f => ({
                                ...f,
                                deliveryMethod: e.target.value as 'domicilio' | 'recoger',
                              }))
                            }
                            className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#C9A84C]/50"
                          >
                            <option value="domicilio" className="bg-[#1A1A1A]">
                              Domicilio (+{formatCOP(DELIVERY_FEE)})
                            </option>
                            <option value="recoger" className="bg-[#1A1A1A]">
                              Recoger en Tienda (Gratis)
                            </option>
                          </select>
                        </div>
                      </div>

                      {form.deliveryMethod === 'domicilio' && (
                        <CheckoutField
                          label="Dirección de Entrega"
                          name="address"
                          value={form.address}
                          onChange={onFormChange('address')}
                          error={errors.address}
                          placeholder="Cra. 7 #114-60, Bogotá"
                          required
                        />
                      )}

                      <div>
                        <label className="block text-white/60 text-xs mb-1.5">
                          Método de Pago *
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { value: 'efectivo', label: 'Efectivo' },
                            { value: 'tarjeta', label: 'Tarjeta' },
                            { value: 'transferencia', label: 'Transferencia' },
                          ].map(({ value, label }) => (
                            <button
                              key={value}
                              onClick={() =>
                                setForm(f => ({ ...f, paymentMethod: value }))
                              }
                              className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                                form.paymentMethod === value
                                  ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                                  : 'border-white/10 text-white/50 hover:border-white/20'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-white/60 text-xs mb-1.5">
                          Notas Especiales
                        </label>
                        <textarea
                          value={form.notes}
                          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Alergias, solicitudes especiales, punto de cocción..."
                          rows={3}
                          maxLength={500}
                          className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50 resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-6">
                      <button
                        onClick={() => setStep('cart')}
                        className="flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" /> Volver al Carrito
                      </button>
                      <button
                        onClick={handlePlaceOrder}
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-3 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#D4AF37] transition-colors text-sm disabled:opacity-60"
                      >
                        {loading ? 'Procesando...' : 'Realizar Pedido'}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Resumen */}
            <div>
              <div className="bg-[#141414] border border-white/5 rounded-2xl p-6 sticky top-24">
                <h3 className="text-white font-semibold mb-5">Resumen del Pedido</h3>
                <div className="space-y-3 mb-5">
                  {items.map(i => (
                    <div key={i.id} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-white/50 truncate">
                          {i.name} ×{i.quantity}
                        </span>
                        <span className="text-white whitespace-nowrap shrink-0">
                          {formatCOP(i.price * i.quantity)}
                        </span>
                      </div>
                      {(i.addOns.length > 0 || i.drinks.length > 0) && (
                        <p className="text-white/25 text-[10px] mt-0.5 pl-0 truncate">
                          {[...i.addOns.map(a => a.name), ...i.drinks.map(d => d.name)].join(
                            ' · '
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/5 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Subtotal</span>
                    <span className="text-white">{formatCOP(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Imp. al Consumo (8%)</span>
                    <span className="text-white">{formatCOP(tax)}</span>
                  </div>
                  {form.deliveryMethod === 'domicilio' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/50">Domicilio</span>
                      <span className="text-white">{formatCOP(deliveryFee)}</span>
                    </div>
                  )}
                  <div className="border-t border-white/5 pt-3 flex justify-between">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-[#C9A84C] font-bold text-lg">{formatCOP(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
