/**
 * API local — todas las operaciones usan localStorage (sin Supabase ni red)
 */
import * as db from './localDB';

// Re-exportar formatCOP para uso en toda la aplicación
export { formatCOP } from './localDB';

// Pequeño delay artificial para simular async y evitar bloqueo del hilo UI
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

// ─── Productos ────────────────────────────────────────────────

export async function getProducts() {
  await tick();
  db.seedDemoProducts(); // Auto-seed en primera carga
  return { products: db.getProducts() };
}

export async function getProduct(id: string) {
  await tick();
  const product = db.getProductById(id);
  if (!product) throw new Error('Producto no encontrado');
  return { product };
}

export async function createProduct(data: Omit<db.Product, 'id' | 'createdAt' | 'updatedAt'>, _token?: string) {
  await tick();
  const product = db.createProduct(data);
  return { product };
}

export async function updateProduct(id: string, data: Partial<db.Product>, _token?: string) {
  await tick();
  const product = db.updateProduct(id, data);
  if (!product) throw new Error('Producto no encontrado');
  return { product };
}

export async function deleteProduct(id: string, _token?: string) {
  await tick();
  db.deleteProduct(id);
  return { message: 'Producto eliminado' };
}

// ─── Pedidos ──────────────────────────────────────────────────

export async function getOrders(_token?: string) {
  await tick();
  return { orders: db.getOrders() };
}

export async function getOrder(id: string) {
  await tick();
  const order = db.getOrderById(id);
  if (!order) throw new Error('Pedido no encontrado');
  return { order };
}

export async function createOrder(data: Parameters<typeof db.createOrder>[0]) {
  await tick();
  return db.createOrder(data);
}

export async function updateOrderStatus(id: string, status: db.OrderStatus, _token?: string) {
  await tick();
  const order = db.updateOrderStatus(id, status);
  if (!order) throw new Error('Pedido no encontrado');
  return { order };
}

// ─── Facturas ─────────────────────────────────────────────────

export async function getInvoices(_token?: string) {
  await tick();
  return { invoices: db.getInvoices() };
}

export async function getInvoice(id: string, _token?: string) {
  await tick();
  const invoice = db.getInvoiceById(id);
  if (!invoice) throw new Error('Factura no encontrada');
  return { invoice };
}

// ─── Reservas ─────────────────────────────────────────────────

export async function getReservations(_token?: string) {
  await tick();
  return { reservations: db.getReservations() };
}

export async function createReservation(data: Parameters<typeof db.createReservation>[0]) {
  await tick();
  const reservation = db.createReservation(data);
  return { reservation };
}

export async function updateReservationStatus(id: string, status: db.ReservationStatus, _token?: string) {
  await tick();
  const reservation = db.updateReservationStatus(id, status);
  if (!reservation) throw new Error('Reserva no encontrada');
  return { reservation };
}

// ─── Estadísticas ─────────────────────────────────────────────

export async function getStats(_token?: string) {
  await tick();
  return db.getStats();
}

// ─── Imágenes (sin upload real — usar URL directa) ─────────────

export async function uploadImage(_base64: string, _fileName: string, _mimeType: string, _token?: string) {
  throw new Error('Carga de imágenes por archivo no está disponible en modo local. Usa una URL de imagen directamente.');
}

// ─── Admin ────────────────────────────────────────────────────

export async function checkAdminSetup() {
  await tick();
  return { configured: true };
}

export async function setupAdmin() {
  await tick();
  return {
    message: 'Admin ya configurado localmente',
    email: 'admin@primeandare.com',
    password: 'PrimeRare2024!',
  };
}

export async function seedProducts(_token?: string) {
  await tick();
  const count = db.seedDemoProducts();
  return count > 0
    ? { message: `${count} productos cargados exitosamente` }
    : { message: 'Los productos ya existen' };
}
