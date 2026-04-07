import { formatCOP, type Invoice, type OrderItem } from './localDB';

/** ID de seguimiento del pedido (distinto del número interno PR-xxxx). */
export function getInvoiceTrackingId(inv: Invoice): string {
  return inv.trackingId ?? inv.orderId;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function orderItemCellHtml(item: OrderItem): string {
  const extraLines: string[] = [];
  if (item.addOns?.length) {
    extraLines.push(
      `<div style="font-size:0.85em;color:#555;margin-top:4px">+ ${item.addOns.map(a => escapeHtml(a.name)).join(', ')}</div>`
    );
  }
  if (item.drinks?.length) {
    extraLines.push(
      `<div style="font-size:0.85em;color:#555;margin-top:2px">Beb.: ${item.drinks.map(d => escapeHtml(d.name)).join(', ')}</div>`
    );
  }
  return `<td>${escapeHtml(item.name)}${extraLines.join('')}</td>`;
}

export function buildInvoiceHtmlDocument(inv: Invoice): string {
  const trackingId = getInvoiceTrackingId(inv);
  const rows = inv.items
    .map(
      item => `<tr>
        ${orderItemCellHtml(item)}
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${escapeHtml(formatCOP(item.price))}</td>
        <td style="text-align:right">${escapeHtml(formatCOP(item.price * item.quantity))}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Factura ${escapeHtml(inv.invoiceNumber)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 24px auto; padding: 16px; color: #111; }
  h1 { font-size: 1.5rem; margin: 0 0 8px; }
  .meta { color: #555; font-size: 0.9rem; margin-bottom: 24px; }
  .box { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; }
  th { background: #f5f5f5; font-size: 0.75rem; text-transform: uppercase; color: #666; }
  .totals { margin-top: 16px; text-align: right; }
  .totals div { margin: 4px 0; }
  .total { font-weight: bold; font-size: 1.1rem; color: #8a7030; }
  .track { font-family: ui-monospace, monospace; word-break: break-all; }
</style>
</head>
<body>
  <h1>Prime &amp; Rare — Factura</h1>
  <div class="meta">
    <div><strong>Factura:</strong> ${escapeHtml(inv.invoiceNumber)}</div>
    <div><strong>Número de pedido:</strong> ${escapeHtml(inv.orderNumber)}</div>
    <div><strong>ID de seguimiento:</strong> <span class="track">${escapeHtml(trackingId)}</span></div>
    <div><strong>Fecha:</strong> ${escapeHtml(
      new Date(inv.createdAt).toLocaleString('es-CO', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    )}</div>
  </div>
  <div class="box">
    <strong>Cliente</strong><br/>
    ${escapeHtml(inv.customer.name)}<br/>
    ${escapeHtml(inv.customer.email)}<br/>
    ${escapeHtml(inv.customer.phone)}
    ${inv.customer.address ? `<br/>${escapeHtml(inv.customer.address)}` : ''}
  </div>
  <table>
    <thead>
      <tr><th>Artículo</th><th>Cant.</th><th>P. unit.</th><th>Total</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div>Subtotal: ${escapeHtml(formatCOP(inv.subtotal))}</div>
    <div>Imp. al consumo (8%): ${escapeHtml(formatCOP(inv.tax))}</div>
    ${inv.deliveryFee > 0 ? `<div>Domicilio: ${escapeHtml(formatCOP(inv.deliveryFee))}</div>` : ''}
    <div class="total">Total: ${escapeHtml(formatCOP(inv.total))}</div>
    <div style="margin-top:12px;font-size:0.9rem;">Pago: ${escapeHtml(inv.paymentMethod)}</div>
  </div>
  <p style="margin-top:32px;font-size:0.8rem;color:#888;text-align:center;">Gracias por preferir Prime &amp; Rare.</p>
</body>
</html>`;
}

export function downloadInvoiceHtml(inv: Invoice): void {
  const html = buildInvoiceHtmlDocument(inv);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = inv.invoiceNumber.replace(/[^\w-]/g, '_');
  a.href = url;
  a.download = `Factura-${safe}.html`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
