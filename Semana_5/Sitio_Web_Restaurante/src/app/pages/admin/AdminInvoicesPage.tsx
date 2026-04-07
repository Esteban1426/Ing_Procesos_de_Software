import { useState, useEffect } from 'react';
import { getInvoices, formatCOP } from '../../lib/api';
import { getInvoiceTrackingId } from '../../lib/invoiceDownload';
import { FileText, Search, Printer, ChevronDown, ChevronUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Invoice } from '../../lib/localDB';

export function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    setLoading(true);
    getInvoices()
      .then(d => setInvoices(d.invoices || []))
      .catch(e => console.error('Error cargando facturas:', e))
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase().trim();
  const filtered = invoices.filter(inv => {
    if (!q) return true;
    const track = getInvoiceTrackingId(inv).toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.customer.name.toLowerCase().includes(q) ||
      inv.orderNumber.toLowerCase().includes(q) ||
      track.includes(q)
    );
  });

  const handlePrint = (inv: Invoice) => {
    setPrintInvoice(inv);
    setTimeout(() => window.print(), 300);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Facturas</h2>
        <p className="text-white/40 text-sm">{invoices.length} facturas generadas</p>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por factura, pedido, ID de seguimiento o cliente..."
          className="w-full bg-[#141414] border border-white/10 text-white placeholder-white/30 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
        />
      </div>

      {/* Lista de Facturas */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#141414] rounded-2xl h-16 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#141414] rounded-2xl border border-white/5">
          <FileText className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40">No se encontraron facturas</p>
          <p className="text-white/20 text-xs mt-1">
            Las facturas se generan automáticamente con cada pedido
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => {
            const isExpanded = expanded === inv.id;
            return (
              <div
                key={inv.id}
                className={`bg-[#141414] border rounded-2xl overflow-hidden transition-all ${
                  isExpanded ? 'border-[#C9A84C]/20' : 'border-white/5'
                }`}
              >
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : inv.id)}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-[#C9A84C]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[#C9A84C] font-bold text-sm">{inv.invoiceNumber}</span>
                      <span className="text-white/30 text-xs">→ {inv.orderNumber}</span>
                    </div>
                    <div className="text-white/50 text-xs mt-0.5">{inv.customer.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-2">
                    <div className="text-white font-semibold">{formatCOP(inv.total)}</div>
                    <div className="text-white/30 text-xs">
                      {new Date(inv.createdAt).toLocaleDateString('es-CO')}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handlePrint(inv); }}
                    className="w-8 h-8 rounded-lg bg-[#1A1A1A] flex items-center justify-center text-white/40 hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all flex-shrink-0"
                    title="Imprimir factura"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
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
                          {/* Líneas */}
                          <div>
                            <h4 className="text-white/60 text-xs uppercase tracking-wider mb-3">
                              Líneas de Factura
                            </h4>
                            <div className="space-y-2">
                              {inv.items.map((item, i) => (
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
                                    <div className="text-white/35 text-xs mt-1 space-y-0.5">
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
                                  <span>Subtotal</span>
                                  <span>{formatCOP(inv.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-white/40">
                                  <span>Imp. al Consumo (8%)</span>
                                  <span>{formatCOP(inv.tax)}</span>
                                </div>
                                {inv.deliveryFee > 0 && (
                                  <div className="flex justify-between text-xs text-white/40">
                                    <span>Domicilio</span>
                                    <span>{formatCOP(inv.deliveryFee)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm font-semibold border-t border-white/5 pt-2">
                                  <span className="text-white">Total</span>
                                  <span className="text-[#C9A84C]">{formatCOP(inv.total)}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Facturado a */}
                          <div>
                            <h4 className="text-white/60 text-xs uppercase tracking-wider mb-3">
                              Facturado a
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="text-white font-medium">{inv.customer.name}</div>
                              <div className="text-white/50 text-xs">{inv.customer.email}</div>
                              {inv.customer.phone && (
                                <div className="text-white/50 text-xs">{inv.customer.phone}</div>
                              )}
                              {inv.customer.address && (
                                <div className="text-white/50 text-xs">{inv.customer.address}</div>
                              )}
                              <div className="mt-3 pt-3 border-t border-white/5">
                                <div className="flex justify-between text-xs">
                                  <span className="text-white/40">Pago</span>
                                  <span className="text-white capitalize">{inv.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between text-xs mt-1">
                                  <span className="text-white/40">Emisión</span>
                                  <span className="text-white">
                                    {new Date(inv.createdAt).toLocaleDateString('es-CO', {
                                      year: 'numeric', month: 'long', day: 'numeric',
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-5 flex justify-end">
                          <button
                            onClick={() => handlePrint(inv)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-[#0A0A0A] rounded-xl font-semibold text-sm hover:bg-[#D4AF37] transition-colors"
                          >
                            <Printer className="w-4 h-4" /> Imprimir Factura
                          </button>
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

      {/* Modal de Impresión */}
      <AnimatePresence>
        {printInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white flex items-center justify-center print:!block"
          >
            <div className="relative max-w-2xl w-full mx-auto p-8 bg-white text-[#0A0A0A] print:shadow-none shadow-2xl rounded-2xl m-4 print:m-0 print:rounded-none overflow-y-auto max-h-screen">
              <button
                onClick={() => setPrintInvoice(null)}
                className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 print:hidden"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="print:p-0">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <div className="text-2xl font-bold text-[#0A0A0A]">
                      Prime <span className="text-[#C9A84C]">&amp;</span> Rare
                    </div>
                    <div className="text-gray-500 text-sm mt-1">Asador Premium</div>
                    <div className="text-gray-400 text-xs mt-1">Cra. 7 #114-60, Bogotá, Colombia</div>
                    <div className="text-gray-400 text-xs">NIT: 900.123.456-7</div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-[#C9A84C]">
                      {printInvoice.invoiceNumber}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      Pedido: {printInvoice.orderNumber}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      ID de seguimiento:{' '}
                      <span className="font-mono text-gray-700">
                        {getInvoiceTrackingId(printInvoice)}
                      </span>
                    </div>
                    <div className="text-gray-400 text-xs mt-1">
                      {new Date(printInvoice.createdAt).toLocaleDateString('es-CO', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10">
                  <div>
                    <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                      Facturado a
                    </div>
                    <div className="font-semibold">{printInvoice.customer.name}</div>
                    <div className="text-gray-600 text-sm">{printInvoice.customer.email}</div>
                    <div className="text-gray-600 text-sm">{printInvoice.customer.phone}</div>
                    {printInvoice.customer.address && (
                      <div className="text-gray-600 text-sm">{printInvoice.customer.address}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">
                      Información de Pago
                    </div>
                    <div className="text-gray-600 text-sm capitalize">
                      Método: {printInvoice.paymentMethod}
                    </div>
                    <div className="mt-2 inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      PAGADO
                    </div>
                  </div>
                </div>

                <table className="w-full mb-8 border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">
                        Artículo
                      </th>
                      <th className="text-center py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">
                        Cant.
                      </th>
                      <th className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">
                        Precio Unit.
                      </th>
                      <th className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {printInvoice.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-3 px-4 text-sm">
                          <div className="font-medium">{item.name}</div>
                          {item.addOns && item.addOns.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              + {item.addOns.map(a => a.name).join(', ')}
                            </div>
                          )}
                          {item.drinks && item.drinks.length > 0 && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              Beb.: {item.drinks.map(d => d.name).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-center">{item.quantity}</td>
                        <td className="py-3 px-4 text-sm text-right">{formatCOP(item.price)}</td>
                        <td className="py-3 px-4 text-sm text-right font-medium">
                          {formatCOP(item.price * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-72 space-y-2">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span>
                      <span>{formatCOP(printInvoice.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Imp. al Consumo (8%)</span>
                      <span>{formatCOP(printInvoice.tax)}</span>
                    </div>
                    {printInvoice.deliveryFee > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Domicilio</span>
                        <span>{formatCOP(printInvoice.deliveryFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
                      <span>Total</span>
                      <span className="text-[#C9A84C]">{formatCOP(printInvoice.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-6 border-t border-gray-100 text-center text-gray-400 text-xs">
                  ¡Gracias por preferir Prime &amp; Rare! Esperamos verte pronto.
                </div>
              </div>

              <div className="mt-6 flex justify-end print:hidden">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-6 py-3 bg-[#C9A84C] text-[#0A0A0A] rounded-xl font-bold text-sm hover:bg-[#D4AF37] transition-colors"
                >
                  <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
