import { useState, useEffect } from 'react';
import {
  getProducts, createProduct, updateProduct, deleteProduct, formatCOP,
} from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Plus, Edit2, Trash2, Star, Package, Search, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import type { Product } from '../../lib/localDB';
import {
  MAX_DESCRIPTION_LEN,
  validatePersonName,
  validateProductPrice,
  validateProductRating,
  validateUrlOptional,
} from '../../lib/validation';

const CATEGORIAS = ['steaks', 'ribs', 'lamb', 'burgers', 'sharing', 'otros'];
const ETIQUETAS_CAT: Record<string, string> = {
  steaks: 'Cortes',
  ribs: 'Costillas',
  lamb: 'Cordero',
  burgers: 'Hamburguesas',
  sharing: 'Para Compartir',
  otros: 'Otros',
};

const FORM_VACIO = {
  name: '', description: '', price: '', category: 'steaks',
  imageUrl: '', weight: '', origin: '', rating: '4.5',
  inStock: true, featured: false,
};

export function AdminProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<typeof FORM_VACIO & Record<string, any>>(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const d = await getProducts();
      setProducts(d.products || []);
    } catch (e) {
      console.error('Error cargando productos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(FORM_VACIO);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description, price: String(p.price),
      category: p.category, imageUrl: p.imageUrl, weight: p.weight || '',
      origin: p.origin || '', rating: String(p.rating),
      inStock: p.inStock, featured: p.featured,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const nameErr = validatePersonName(form.name);
    if (nameErr) {
      toast.error(nameErr, { style: { background: '#141414', color: '#fff' } });
      return;
    }
    const priceErr = validateProductPrice(form.price);
    if (priceErr) {
      toast.error(priceErr, { style: { background: '#141414', color: '#fff' } });
      return;
    }
    const ratingErr = validateProductRating(form.rating);
    if (ratingErr) {
      toast.error(ratingErr, { style: { background: '#141414', color: '#fff' } });
      return;
    }
    const urlErr = validateUrlOptional(form.imageUrl);
    if (urlErr) {
      toast.error(urlErr, { style: { background: '#141414', color: '#fff' } });
      return;
    }
    if (form.description.length > MAX_DESCRIPTION_LEN) {
      toast.error('La descripción es demasiado larga', {
        style: { background: '#141414', color: '#fff' },
      });
      return;
    }
    setSaving(true);
    try {
      const name = form.name.trim();
      if (editing) {
        await updateProduct(editing.id, {
          ...form,
          name,
          description: form.description.trim(),
          price: parseFloat(form.price),
          rating: parseFloat(form.rating),
        });
        toast.success('¡Producto actualizado!', {
          style: { background: '#141414', color: '#fff', border: '1px solid #C9A84C33' },
        });
      } else {
        await createProduct({
          ...form,
          name,
          description: form.description.trim(),
          price: parseFloat(form.price),
          rating: parseFloat(form.rating),
        });
        toast.success('¡Producto creado!', {
          style: { background: '#141414', color: '#fff', border: '1px solid #C9A84C33' },
        });
      }
      setShowModal(false);
      fetchProducts();
    } catch (e: any) {
      toast.error(`Error al guardar: ${e.message}`, {
        style: { background: '#141414', color: '#fff' },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      toast.success('Producto eliminado', {
        style: { background: '#141414', color: '#fff' },
      });
      setDeleteId(null);
      fetchProducts();
    } catch (e: any) {
      toast.error(`Error: ${e.message}`, { style: { background: '#141414', color: '#fff' } });
    }
  };

  const filtered = products.filter(
    p =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Productos</h2>
          <p className="text-white/40 text-sm">{products.length} productos en el menú</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-[#0A0A0A] rounded-xl font-semibold text-sm hover:bg-[#D4AF37] transition-colors"
        >
          <Plus className="w-4 h-4" /> Agregar Producto
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar productos..."
          className="w-full bg-[#141414] border border-white/10 text-white placeholder-white/30 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
        />
      </div>

      {/* Grilla */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#141414] rounded-2xl h-72 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-[#141414] rounded-2xl border border-white/5">
          <Package className="w-12 h-12 text-white/10 mx-auto mb-4" />
          <p className="text-white/40">No se encontraron productos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(p => (
            <motion.div
              key={p.id}
              layout
              className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden group"
            >
              <div className="relative h-44">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#1A1A1A] flex items-center justify-center">
                    <Package className="w-10 h-10 text-white/10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141414]/80 to-transparent" />
                <div className="absolute top-3 left-3 flex gap-2">
                  {p.featured && (
                    <span className="text-[10px] bg-[#C9A84C] text-[#0A0A0A] px-2 py-0.5 rounded-full font-semibold">
                      Destacado
                    </span>
                  )}
                  {!p.inStock && (
                    <span className="text-[10px] bg-red-500/80 text-white px-2 py-0.5 rounded-full font-semibold">
                      Agotado
                    </span>
                  )}
                </div>
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(p)}
                    className="w-8 h-8 bg-[#141414]/90 rounded-lg flex items-center justify-center text-white hover:bg-[#C9A84C] hover:text-[#0A0A0A] transition-all"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(p.id)}
                    className="w-8 h-8 bg-[#141414]/90 rounded-lg flex items-center justify-center text-white hover:bg-red-500 transition-all"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-white font-semibold text-sm">{p.name}</h3>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-[#C9A84C] fill-[#C9A84C]" />
                    <span className="text-white/60 text-xs">{p.rating}</span>
                  </div>
                </div>
                <p className="text-white/40 text-xs line-clamp-2 mb-3">{p.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[#C9A84C] font-bold">{formatCOP(p.price)}</span>
                  <div className="flex items-center gap-2 text-xs text-white/30">
                    <span>{ETIQUETAS_CAT[p.category] ?? p.category}</span>
                    {p.weight && <><span>·</span><span>{p.weight}</span></>}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal Producto */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#141414] z-10">
                <h3 className="text-white font-semibold">
                  {editing ? 'Editar Producto' : 'Nuevo Producto'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* URL de Imagen */}
                <div>
                  <label className="block text-white/60 text-xs mb-2">URL de Imagen</label>
                  {form.imageUrl && (
                    <div className="relative mb-3 rounded-xl overflow-hidden h-40">
                      <img
                        src={form.imageUrl}
                        alt="preview"
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <button
                        onClick={() => setForm((f: any) => ({ ...f, imageUrl: '' }))}
                        className="absolute top-2 right-2 w-7 h-7 bg-[#141414]/90 rounded-full flex items-center justify-center text-white hover:bg-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <input
                    value={form.imageUrl}
                    onChange={e => setForm((f: any) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    className="w-full bg-[#1A1A1A] border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C9A84C]/50"
                  />
                </div>

                {/* Campos */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-white/60 text-xs mb-1.5">Nombre *</label>
                    <input
                      value={form.name}
                      onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
                      placeholder="Wagyu Ribeye A5"
                      className="w-full bg-[#1A1A1A] border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-white/60 text-xs mb-1.5">Descripción</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                      placeholder="Describe el corte..."
                      rows={3}
                      maxLength={MAX_DESCRIPTION_LEN}
                      className="w-full bg-[#1A1A1A] border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">Precio (COP) *</label>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={form.price}
                      onChange={e => setForm((f: any) => ({ ...f, price: e.target.value }))}
                      placeholder="380000"
                      className="w-full bg-[#1A1A1A] border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">Categoría</label>
                    <select
                      value={form.category}
                      onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))}
                      className="w-full bg-[#1A1A1A] border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
                    >
                      {CATEGORIAS.map(c => (
                        <option key={c} value={c} className="bg-[#141414]">
                          {ETIQUETAS_CAT[c] ?? c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">Peso</label>
                    <input
                      value={form.weight}
                      onChange={e => setForm((f: any) => ({ ...f, weight: e.target.value }))}
                      placeholder="300g"
                      className="w-full bg-[#1A1A1A] border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">Origen</label>
                    <input
                      value={form.origin}
                      onChange={e => setForm((f: any) => ({ ...f, origin: e.target.value }))}
                      placeholder="Japón"
                      className="w-full bg-[#1A1A1A] border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">Calificación (0–5)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={form.rating}
                      onChange={e => setForm((f: any) => ({ ...f, rating: e.target.value }))}
                      placeholder="4.5"
                      className="w-full bg-[#1A1A1A] border border-white/10 text-white placeholder-white/20 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A84C]/50"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex gap-4">
                  {[
                    { key: 'inStock', label: 'Disponible' },
                    { key: 'featured', label: 'Destacado' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setForm((f: any) => ({ ...f, [key]: !f[key] }))}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        (form as Record<string, any>)[key]
                          ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                          : 'border-white/10 text-white/40'
                      }`}
                    >
                      {(form as Record<string, any>)[key] ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6 border-t border-white/5 flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-white/10 text-white/60 rounded-xl hover:bg-white/5 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#D4AF37] transition-colors text-sm disabled:opacity-60"
                >
                  {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Producto'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmar Eliminación */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#141414] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center"
            >
              <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">¿Eliminar Producto?</h3>
              <p className="text-white/40 text-sm mb-6">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 border border-white/10 text-white/60 rounded-xl text-sm hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
