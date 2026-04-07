/**
 * Base de datos local usando localStorage
 * Reemplaza completamente la integración con Supabase
 */

const DB_PREFIX = 'pr_';
const ADMIN_EMAIL = 'admin@primeandare.com';
const ADMIN_PASSWORD = 'PrimeRare2024!';

// ─── Utilidades internas ───────────────────────────────────────

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function dbGet<T>(key: string): T | null {
  try {
    const val = localStorage.getItem(DB_PREFIX + key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

function dbSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('Error guardando en localStorage:', e);
  }
}

function dbDel(key: string): void {
  localStorage.removeItem(DB_PREFIX + key);
}

function dbGetByPrefix<T>(prefix: string): T[] {
  const results: T[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DB_PREFIX + prefix)) {
        const raw = localStorage.getItem(key);
        if (raw) results.push(JSON.parse(raw) as T);
      }
    }
  } catch (e) {
    console.error('Error leyendo localStorage:', e);
  }
  return results;
}

function nextSeq(key: string): number {
  const cur = dbGet<number>(`seq:${key}`) ?? 0;
  const next = cur + 1;
  dbSet(`seq:${key}`, next);
  return next;
}

// ─── Formateo de moneda COP ────────────────────────────────────

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Autenticación local ───────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  token: string;
}

export function adminLogin(email: string, password: string): AdminUser | null {
  if (
    email.toLowerCase().trim() === ADMIN_EMAIL &&
    password === ADMIN_PASSWORD
  ) {
    const token = generateId() + generateId();
    const user: AdminUser = {
      id: 'admin-001',
      email: ADMIN_EMAIL,
      name: 'Administrador',
      token,
    };
    dbSet('admin:session', user);
    return user;
  }
  return null;
}

export function adminLogout(): void {
  dbDel('admin:session');
}

export function getAdminSession(): AdminUser | null {
  return dbGet<AdminUser>('admin:session');
}

// ─── Productos ────────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // COP
  category: string;
  imageUrl: string;
  weight?: string;
  origin?: string;
  rating: number;
  inStock: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getProducts(): Product[] {
  return dbGetByPrefix<Product>('product:').sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getProductById(id: string): Product | null {
  return dbGet<Product>(`product:${id}`);
}

export function createProduct(
  data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Product {
  const id = generateId();
  const product: Product = {
    ...data,
    id,
    price: Number(data.price),
    rating: Number(data.rating),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  dbSet(`product:${id}`, product);
  return product;
}

export function updateProduct(
  id: string,
  data: Partial<Omit<Product, 'id' | 'createdAt'>>
): Product | null {
  const existing = getProductById(id);
  if (!existing) return null;
  const updated: Product = {
    ...existing,
    ...data,
    id,
    price: data.price !== undefined ? Number(data.price) : existing.price,
    rating: data.rating !== undefined ? Number(data.rating) : existing.rating,
    updatedAt: new Date().toISOString(),
  };
  dbSet(`product:${id}`, updated);
  return updated;
}

export function deleteProduct(id: string): void {
  dbDel(`product:${id}`);
}

// ─── Pedidos ──────────────────────────────────────────────────

export type OrderStatus =
  | 'pendiente'
  | 'preparando'
  | 'listo'
  | 'entregado'
  | 'cancelado';

export interface OrderItemExtra {
  id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  addOns?: OrderItemExtra[];
  drinks?: OrderItemExtra[];
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: OrderItem[];
  subtotal: number;
  tax: number;        // 8% impuesto al consumo
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  deliveryMethod: 'domicilio' | 'recoger';
  paymentMethod: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const DELIVERY_FEE = 15000;  // COP
export const TAX_RATE = 0.08;       // 8% impuesto al consumo

export function getOrders(): Order[] {
  return dbGetByPrefix<Order>('order:').sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getOrderById(id: string): Order | null {
  return dbGet<Order>(`order:${id}`);
}

export function createOrder(data: {
  customer: Order['customer'];
  items: OrderItem[];
  deliveryMethod: Order['deliveryMethod'];
  paymentMethod: string;
  notes?: string;
}): { order: Order; invoice: Invoice } {
  const id = generateId();
  const seq = nextSeq('orders');
  const orderNumber = `PR-${String(seq).padStart(4, '0')}`;

  const subtotal = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const deliveryFee = data.deliveryMethod === 'domicilio' ? DELIVERY_FEE : 0;
  const total = subtotal + tax + deliveryFee;

  const order: Order = {
    id,
    orderNumber,
    customer: data.customer,
    items: data.items,
    subtotal,
    tax,
    deliveryFee,
    total,
    status: 'pendiente',
    deliveryMethod: data.deliveryMethod,
    paymentMethod: data.paymentMethod,
    notes: data.notes ?? '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  dbSet(`order:${id}`, order);
  const invoice = _createInvoice(order);
  return { order, invoice };
}

export function updateOrderStatus(
  id: string,
  status: OrderStatus
): Order | null {
  const existing = getOrderById(id);
  if (!existing) return null;
  const updated: Order = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };
  dbSet(`order:${id}`, updated);
  return updated;
}

// ─── Facturas ─────────────────────────────────────────────────

export interface Invoice {
  id: string;
  invoiceNumber: string;
  /** Mismo valor que el id del pedido; para rastreo en /track (distinto del número PR-xxxx). */
  trackingId?: string;
  orderId: string;
  orderNumber: string;
  customer: Order['customer'];
  items: OrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
}

function _createInvoice(order: Order): Invoice {
  const id = generateId();
  const seq = nextSeq('invoices');
  const invoice: Invoice = {
    id,
    invoiceNumber: `FAC-${String(seq).padStart(4, '0')}`,
    trackingId: order.id,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customer: order.customer,
    items: order.items,
    subtotal: order.subtotal,
    tax: order.tax,
    deliveryFee: order.deliveryFee,
    total: order.total,
    paymentMethod: order.paymentMethod,
    createdAt: new Date().toISOString(),
  };
  dbSet(`invoice:${id}`, invoice);
  return invoice;
}

export function getInvoices(): Invoice[] {
  return dbGetByPrefix<Invoice>('invoice:').sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getInvoiceById(id: string): Invoice | null {
  return dbGet<Invoice>(`invoice:${id}`);
}

// ─── Reservas ─────────────────────────────────────────────────

export type ReservationStatus = 'confirmada' | 'cancelada' | 'completada';

export interface Reservation {
  id: string;
  reservationNumber: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  occasion: string;
  notes: string;
  status: ReservationStatus;
  createdAt: string;
}

export function getReservations(): Reservation[] {
  return dbGetByPrefix<Reservation>('reservation:').sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export function createReservation(
  data: Omit<Reservation, 'id' | 'reservationNumber' | 'status' | 'createdAt'>
): Reservation {
  const id = generateId();
  const seq = nextSeq('reservations');
  const reservation: Reservation = {
    ...data,
    guests: Number(data.guests),
    id,
    reservationNumber: `RES-${String(seq).padStart(3, '0')}`,
    status: 'confirmada',
    createdAt: new Date().toISOString(),
  };
  dbSet(`reservation:${id}`, reservation);
  return reservation;
}

export function updateReservationStatus(
  id: string,
  status: ReservationStatus
): Reservation | null {
  const existing = dbGet<Reservation>(`reservation:${id}`);
  if (!existing) return null;
  const updated: Reservation = { ...existing, status };
  dbSet(`reservation:${id}`, updated);
  return updated;
}

// ─── Estadísticas ─────────────────────────────────────────────

export function getStats() {
  const orders = getOrders();
  const products = getProducts();
  const reservations = getReservations();
  const invoices = getInvoices();

  const activeOrders = orders.filter(o => o.status !== 'cancelado');
  const totalRevenue = activeOrders.reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pendiente').length;
  const preparingOrders = orders.filter(o => o.status === 'preparando').length;
  const deliveredOrders = orders.filter(o => o.status === 'entregado').length;

  const now = new Date();
  const monthlySales = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const monthName = d.toLocaleString('es-CO', { month: 'short' });
    const year = d.getFullYear();
    const month = d.getMonth();
    const revenue = orders
      .filter(o => {
        const od = new Date(o.createdAt);
        return (
          od.getFullYear() === year &&
          od.getMonth() === month &&
          o.status !== 'cancelado'
        );
      })
      .reduce((s, o) => s + o.total, 0);
    return { month: monthName.charAt(0).toUpperCase() + monthName.slice(1), revenue };
  });

  return {
    totalRevenue,
    totalOrders: orders.length,
    pendingOrders,
    preparingOrders,
    deliveredOrders,
    totalProducts: products.length,
    totalReservations: reservations.length,
    totalInvoices: invoices.length,
    monthlySales,
  };
}

// ─── Datos de demostración ─────────────────────────────────────

const DEMO_PRODUCTS: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Wagyu Ribeye A5',
    description:
      'Exquisito Wagyu A5 japonés con extraordinario marmoleado. Una textura que se derrite en la boca y define la gastronomía de lujo.',
    price: 380000,
    category: 'steaks',
    imageUrl:
      'https://images.unsplash.com/photo-1690983320937-ca293f1d1d97?w=800&q=80',
    weight: '300g',
    origin: 'Japón',
    rating: 5.0,
    inStock: true,
    featured: true,
  },
  {
    name: 'Tomahawk Premium',
    description:
      'Espectacular chuleta de hueso largo cortada de la sección de costilla premium. Un verdadero espectáculo para cualquier ocasión especial.',
    price: 545000,
    category: 'steaks',
    imageUrl:
      'https://images.unsplash.com/photo-1728042359879-f5d2c233a07c?w=800&q=80',
    weight: '800g',
    origin: 'Australia',
    rating: 4.9,
    inStock: true,
    featured: true,
  },
  {
    name: 'Costillas Ahumadas',
    description:
      'Costillas baby back ahumadas a fuego lento durante 8 horas con nuestra mezcla exclusiva de especias. Perfección que se cae del hueso.',
    price: 230000,
    category: 'ribs',
    imageUrl:
      'https://images.unsplash.com/photo-1679711246825-1f2bd51b16d0?w=800&q=80',
    weight: '600g',
    origin: 'EE.UU.',
    rating: 4.8,
    inStock: true,
    featured: true,
  },
  {
    name: 'Rack de Cordero',
    description:
      'Rack de cordero con costra de hierbas finas. Cortes tiernos y aromáticos provenientes de las mejores granjas de Nueva Zelanda.',
    price: 305000,
    category: 'lamb',
    imageUrl:
      'https://images.unsplash.com/photo-1766589152343-874c0e138262?w=800&q=80',
    weight: '450g',
    origin: 'Nueva Zelanda',
    rating: 4.7,
    inStock: true,
    featured: false,
  },
  {
    name: 'Smash Burger Prime',
    description:
      'Doble smash burger con mezcla de res añejada, cheddar curado, cebollas caramelizadas y la salsa secreta de la casa.',
    price: 105000,
    category: 'burgers',
    imageUrl:
      'https://images.unsplash.com/photo-1735643359858-8cbdda824a9a?w=800&q=80',
    weight: '280g',
    origin: 'Colombia',
    rating: 4.6,
    inStock: true,
    featured: false,
  },
  {
    name: 'Tabla de Charcutería',
    description:
      'Selección artesanal de embutidos premium, salsas caseras, encurtidos y pan fresco. Perfecto para compartir entre amigos.',
    price: 165000,
    category: 'sharing',
    imageUrl:
      'https://images.unsplash.com/photo-1694460263761-c93d3759f4b3?w=800&q=80',
    weight: '500g',
    origin: 'Europa',
    rating: 4.8,
    inStock: true,
    featured: false,
  },
  {
    name: 'Filet Mignon',
    description:
      'El rey de la terneza — filet center-cut con textura mantecosa y sabor profundo. Servido con mantequilla de trufa negra.',
    price: 330000,
    category: 'steaks',
    imageUrl:
      'https://images.unsplash.com/photo-1632084687062-522d7b1d4b95?w=800&q=80',
    weight: '250g',
    origin: 'EE.UU.',
    rating: 4.9,
    inStock: true,
    featured: true,
  },
  {
    name: 'Short Ribs Angus',
    description:
      'Costillas cortas Angus braseadas cocinadas lentamente durante 12 horas. Ricas, reconfortantes y profundamente satisfactorias.',
    price: 190000,
    category: 'ribs',
    imageUrl:
      'https://images.unsplash.com/photo-1679711246825-1f2bd51b16d0?w=800&q=80',
    weight: '500g',
    origin: 'Argentina',
    rating: 4.7,
    inStock: true,
    featured: false,
  },
];

export function seedDemoProducts(): number {
  const existing = getProducts();
  if (existing.length > 0) return 0;
  DEMO_PRODUCTS.forEach(d => createProduct(d));
  return DEMO_PRODUCTS.length;
}

export function isAdminConfigured(): boolean {
  return true; // Admin is always configured locally
}
