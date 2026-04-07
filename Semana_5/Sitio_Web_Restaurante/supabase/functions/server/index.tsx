import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use('*', logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PRODUCTS_BUCKET = 'make-54897cbc-products';
const INVOICES_BUCKET = 'make-54897cbc-invoices';

// Initialize storage buckets on startup
(async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    for (const bucketName of [PRODUCTS_BUCKET, INVOICES_BUCKET]) {
      const exists = buckets?.some(b => b.name === bucketName);
      if (!exists) {
        await supabase.storage.createBucket(bucketName, { public: false });
        console.log(`Created bucket: ${bucketName}`);
      }
    }
  } catch (e) {
    console.log('Bucket init error:', e);
  }
})();

// ─── Auth helper ──────────────────────────────────────────────
async function verifyAdmin(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.split(' ')[1];
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.id) return null;
  return user.id;
}

function generateId(): string {
  return crypto.randomUUID();
}

async function getNextSequence(key: string): Promise<number> {
  const current = await kv.get(key);
  const next = (current ? parseInt(current as string) : 0) + 1;
  await kv.set(key, String(next));
  return next;
}

// ─── Health ───────────────────────────────────────────────────
app.get("/make-server-54897cbc/health", (c) => c.json({ status: "ok", service: "Prime & Rare" }));

// ─── Admin Setup ──────────────────────────────────────────────
app.post("/make-server-54897cbc/admin/setup", async (c) => {
  try {
    const existing = await kv.get("admin:setup:done");
    if (existing) return c.json({ error: "Admin already configured" }, 400);

    const { data, error } = await supabase.auth.admin.createUser({
      email: "admin@primeandare.com",
      password: "PrimeRare2024!",
      user_metadata: { name: "Admin", role: "admin" },
      email_confirm: true,
    });
    if (error) throw error;

    await kv.set("admin:setup:done", "true");
    await kv.set("admin:user:id", data.user.id);
    return c.json({ message: "Admin created successfully", email: "admin@primeandare.com", password: "PrimeRare2024!" });
  } catch (e: any) {
    console.log("Admin setup error:", e);
    return c.json({ error: `Admin setup failed: ${e.message}` }, 500);
  }
});

app.get("/make-server-54897cbc/admin/status", async (c) => {
  const done = await kv.get("admin:setup:done");
  return c.json({ configured: !!done });
});

// ─── Products ─────────────────────────────────────────────────
app.get("/make-server-54897cbc/products", async (c) => {
  try {
    const products = await kv.getByPrefix("product:");
    return c.json({ products: products || [] });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch products: ${e.message}` }, 500);
  }
});

app.get("/make-server-54897cbc/products/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const product = await kv.get(`product:${id}`);
    if (!product) return c.json({ error: "Product not found" }, 404);
    return c.json({ product });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch product: ${e.message}` }, 500);
  }
});

app.post("/make-server-54897cbc/products", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const body = await c.req.json();
    const id = generateId();
    const product = {
      id,
      name: body.name,
      description: body.description,
      price: parseFloat(body.price),
      category: body.category,
      imageUrl: body.imageUrl || "",
      weight: body.weight || "",
      origin: body.origin || "",
      rating: parseFloat(body.rating) || 4.5,
      inStock: body.inStock !== false,
      featured: body.featured || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`product:${id}`, product);
    return c.json({ product }, 201);
  } catch (e: any) {
    return c.json({ error: `Failed to create product: ${e.message}` }, 500);
  }
});

app.put("/make-server-54897cbc/products/:id", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const id = c.req.param("id");
    const existing: any = await kv.get(`product:${id}`);
    if (!existing) return c.json({ error: "Product not found" }, 404);
    const body = await c.req.json();
    const updated = {
      ...existing,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      price: body.price !== undefined ? parseFloat(body.price) : existing.price,
      category: body.category ?? existing.category,
      imageUrl: body.imageUrl ?? existing.imageUrl,
      weight: body.weight ?? existing.weight,
      origin: body.origin ?? existing.origin,
      rating: body.rating !== undefined ? parseFloat(body.rating) : existing.rating,
      inStock: body.inStock !== undefined ? body.inStock : existing.inStock,
      featured: body.featured !== undefined ? body.featured : existing.featured,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`product:${id}`, updated);
    return c.json({ product: updated });
  } catch (e: any) {
    return c.json({ error: `Failed to update product: ${e.message}` }, 500);
  }
});

app.delete("/make-server-54897cbc/products/:id", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const id = c.req.param("id");
    await kv.del(`product:${id}`);
    return c.json({ message: "Product deleted" });
  } catch (e: any) {
    return c.json({ error: `Failed to delete product: ${e.message}` }, 500);
  }
});

// ─── Image Upload ─────────────────────────────────────────────
app.post("/make-server-54897cbc/upload", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const body = await c.req.json();
    const { base64, fileName, mimeType } = body;
    const base64Data = base64.replace(/^data:[^;]+;base64,/, "");
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const uniqueName = `${Date.now()}-${fileName}`;
    const { error } = await supabase.storage.from(PRODUCTS_BUCKET).upload(uniqueName, bytes, { contentType: mimeType });
    if (error) throw error;
    const { data: signedData } = await supabase.storage.from(PRODUCTS_BUCKET).createSignedUrl(uniqueName, 60 * 60 * 24 * 365);
    return c.json({ url: signedData?.signedUrl, path: uniqueName });
  } catch (e: any) {
    return c.json({ error: `Upload failed: ${e.message}` }, 500);
  }
});

app.post("/make-server-54897cbc/upload/refresh-url", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const { path } = await c.req.json();
    const { data } = await supabase.storage.from(PRODUCTS_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
    return c.json({ url: data?.signedUrl });
  } catch (e: any) {
    return c.json({ error: `URL refresh failed: ${e.message}` }, 500);
  }
});

// ─── Orders ───────────────────────────────────────────────────
app.get("/make-server-54897cbc/orders", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const orders = await kv.getByPrefix("order:");
    const sorted = (orders || []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ orders: sorted });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch orders: ${e.message}` }, 500);
  }
});

app.get("/make-server-54897cbc/orders/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const order = await kv.get(`order:${id}`);
    if (!order) return c.json({ error: "Order not found" }, 404);
    return c.json({ order });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch order: ${e.message}` }, 500);
  }
});

app.post("/make-server-54897cbc/orders", async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId();
    const seq = await getNextSequence("seq:orders");
    const orderNumber = `PR-${String(seq).padStart(4, "0")}`;
    const subtotal = body.items.reduce((s: number, i: any) => s + i.price * i.quantity, 0);
    const tax = subtotal * 0.1;
    const deliveryFee = body.deliveryMethod === "delivery" ? 8.99 : 0;
    const total = subtotal + tax + deliveryFee;
    const order = {
      id,
      orderNumber,
      customer: {
        name: body.customer.name,
        email: body.customer.email,
        phone: body.customer.phone,
        address: body.customer.address || "",
      },
      items: body.items,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      deliveryFee: Math.round(deliveryFee * 100) / 100,
      total: Math.round(total * 100) / 100,
      status: "pending",
      deliveryMethod: body.deliveryMethod || "delivery",
      paymentMethod: body.paymentMethod || "card",
      notes: body.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`order:${id}`, order);

    // Auto-generate invoice
    const invId = generateId();
    const invSeq = await getNextSequence("seq:invoices");
    const invoiceNumber = `INV-${String(invSeq).padStart(4, "0")}`;
    const invoice = {
      id: invId,
      invoiceNumber,
      trackingId: id,
      orderId: id,
      orderNumber,
      customer: order.customer,
      items: order.items,
      subtotal: order.subtotal,
      tax: order.tax,
      deliveryFee: order.deliveryFee,
      total: order.total,
      paymentMethod: order.paymentMethod,
      createdAt: new Date().toISOString(),
    };
    await kv.set(`invoice:${invId}`, invoice);

    return c.json({ order, invoice }, 201);
  } catch (e: any) {
    return c.json({ error: `Failed to create order: ${e.message}` }, 500);
  }
});

app.put("/make-server-54897cbc/orders/:id/status", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const id = c.req.param("id");
    const { status } = await c.req.json();
    const valid = ["pending", "preparing", "ready", "delivered", "cancelled"];
    if (!valid.includes(status)) return c.json({ error: "Invalid status" }, 400);
    const existing: any = await kv.get(`order:${id}`);
    if (!existing) return c.json({ error: "Order not found" }, 404);
    const updated = { ...existing, status, updatedAt: new Date().toISOString() };
    await kv.set(`order:${id}`, updated);
    return c.json({ order: updated });
  } catch (e: any) {
    return c.json({ error: `Failed to update order status: ${e.message}` }, 500);
  }
});

// ─── Invoices ─────────────────────────────────────────────────
app.get("/make-server-54897cbc/invoices", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const invoices = await kv.getByPrefix("invoice:");
    const sorted = (invoices || []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ invoices: sorted });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch invoices: ${e.message}` }, 500);
  }
});

app.get("/make-server-54897cbc/invoices/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const invoice = await kv.get(`invoice:${id}`);
    if (!invoice) return c.json({ error: "Invoice not found" }, 404);
    return c.json({ invoice });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch invoice: ${e.message}` }, 500);
  }
});

// ─── Reservations ─────────────────────────────────────────────
app.get("/make-server-54897cbc/reservations", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const reservations = await kv.getByPrefix("reservation:");
    const sorted = (reservations || []).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return c.json({ reservations: sorted });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch reservations: ${e.message}` }, 500);
  }
});

app.post("/make-server-54897cbc/reservations", async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId();
    const seq = await getNextSequence("seq:reservations");
    const reservation = {
      id,
      reservationNumber: `RES-${String(seq).padStart(3, "0")}`,
      name: body.name,
      email: body.email,
      phone: body.phone,
      date: body.date,
      time: body.time,
      guests: parseInt(body.guests),
      occasion: body.occasion || "",
      notes: body.notes || "",
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    await kv.set(`reservation:${id}`, reservation);
    return c.json({ reservation }, 201);
  } catch (e: any) {
    return c.json({ error: `Failed to create reservation: ${e.message}` }, 500);
  }
});

app.put("/make-server-54897cbc/reservations/:id/status", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const id = c.req.param("id");
    const { status } = await c.req.json();
    const existing: any = await kv.get(`reservation:${id}`);
    if (!existing) return c.json({ error: "Reservation not found" }, 404);
    const updated = { ...existing, status, updatedAt: new Date().toISOString() };
    await kv.set(`reservation:${id}`, updated);
    return c.json({ reservation: updated });
  } catch (e: any) {
    return c.json({ error: `Failed to update reservation: ${e.message}` }, 500);
  }
});

// ─── Stats ─────────────────────────────────────────────────────
app.get("/make-server-54897cbc/stats", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const [orders, products, reservations, invoices] = await Promise.all([
      kv.getByPrefix("order:"),
      kv.getByPrefix("product:"),
      kv.getByPrefix("reservation:"),
      kv.getByPrefix("invoice:"),
    ]);
    const ordersArr = (orders || []) as any[];
    const totalRevenue = ordersArr.filter(o => o.status !== "cancelled").reduce((s: number, o: any) => s + o.total, 0);
    const pendingOrders = ordersArr.filter(o => o.status === "pending").length;
    const preparingOrders = ordersArr.filter(o => o.status === "preparing").length;
    const deliveredOrders = ordersArr.filter(o => o.status === "delivered").length;
    
    // Monthly sales data (last 6 months)
    const now = new Date();
    const monthlySales = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const monthName = d.toLocaleString("en", { month: "short" });
      const year = d.getFullYear();
      const month = d.getMonth();
      const revenue = ordersArr
        .filter(o => {
          const od = new Date(o.createdAt);
          return od.getFullYear() === year && od.getMonth() === month && o.status !== "cancelled";
        })
        .reduce((s: number, o: any) => s + o.total, 0);
      return { month: monthName, revenue: Math.round(revenue * 100) / 100 };
    });

    return c.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders: ordersArr.length,
      pendingOrders,
      preparingOrders,
      deliveredOrders,
      totalProducts: (products || []).length,
      totalReservations: (reservations || []).length,
      totalInvoices: (invoices || []).length,
      monthlySales,
    });
  } catch (e: any) {
    return c.json({ error: `Failed to fetch stats: ${e.message}` }, 500);
  }
});

// ─── Seed demo products ────────────────────────────────────────
app.post("/make-server-54897cbc/admin/seed", async (c) => {
  const userId = await verifyAdmin(c.req.header("Authorization"));
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const existing = await kv.getByPrefix("product:");
    if (existing && existing.length > 0) return c.json({ message: "Products already exist", count: existing.length });
    
    const demoProducts = [
      { id: generateId(), name: "Wagyu Ribeye A5", description: "Exquisite Japanese Wagyu A5 grade ribeye with extraordinary marbling. Melt-in-your-mouth texture that defines luxury dining.", price: 89.99, category: "steaks", imageUrl: "https://images.unsplash.com/photo-1690983320937-ca293f1d1d97?w=800&q=80", weight: "300g", origin: "Japan", rating: 5.0, inStock: true, featured: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: generateId(), name: "Prime Tomahawk", description: "Spectacular long-bone tomahawk steak cut from the prime rib section. A true showstopper for any occasion.", price: 129.99, category: "steaks", imageUrl: "https://images.unsplash.com/photo-1728042359879-f5d2c233a07c?w=800&q=80", weight: "800g", origin: "Australia", rating: 4.9, inStock: true, featured: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: generateId(), name: "Slow-Smoked Ribs", description: "Baby back ribs smoked low and slow for 8 hours with our signature dry rub. Fall-off-the-bone perfection.", price: 54.99, category: "ribs", imageUrl: "https://images.unsplash.com/photo-1679711246825-1f2bd51b16d0?w=800&q=80", weight: "600g", origin: "USA", rating: 4.8, inStock: true, featured: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: generateId(), name: "Rack of Lamb", description: "French-trimmed rack of lamb with herb crust. Tender, flavorful cuts from New Zealand's finest farms.", price: 72.99, category: "lamb", imageUrl: "https://images.unsplash.com/photo-1766589152343-874c0e138262?w=800&q=80", weight: "450g", origin: "New Zealand", rating: 4.7, inStock: true, featured: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: generateId(), name: "Prime & Rare Burger", description: "Double smash patty with dry-aged beef blend, aged cheddar, caramelized onions and our secret sauce.", price: 24.99, category: "burgers", imageUrl: "https://images.unsplash.com/photo-1735643359858-8cbdda824a9a?w=800&q=80", weight: "280g", origin: "USA", rating: 4.6, inStock: true, featured: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: generateId(), name: "Charcuterie Board", description: "Artisan selection of premium cured meats, house-made sauces, pickles and fresh bread. Perfect for sharing.", price: 38.99, category: "sharing", imageUrl: "https://images.unsplash.com/photo-1694460263761-c93d3759f4b3?w=800&q=80", weight: "500g", origin: "Europe", rating: 4.8, inStock: true, featured: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: generateId(), name: "Filet Mignon", description: "The king of tenderness — center-cut filet with buttery texture and rich beefy flavor. Served with truffle butter.", price: 78.99, category: "steaks", imageUrl: "https://images.unsplash.com/photo-1632084687062-522d7b1d4b95?w=800&q=80", weight: "250g", origin: "USA", rating: 4.9, inStock: true, featured: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: generateId(), name: "Beef Short Ribs", description: "Braised Angus beef short ribs that have been slow-cooked for 12 hours. Rich, hearty, and deeply satisfying.", price: 44.99, category: "ribs", imageUrl: "https://images.unsplash.com/photo-1679711246825-1f2bd51b16d0?w=800&q=80", weight: "500g", origin: "Argentina", rating: 4.7, inStock: true, featured: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    
    for (const p of demoProducts) {
      await kv.set(`product:${p.id}`, p);
    }
    return c.json({ message: `Seeded ${demoProducts.length} products` });
  } catch (e: any) {
    return c.json({ error: `Seed failed: ${e.message}` }, 500);
  }
});

Deno.serve(app.fetch);
