import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChefHat, Eye, EyeOff, Home, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isValidEmail } from '../lib/validation';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export function AdminLoginPage() {
  const [email, setEmail] = useState('admin@primeandare.com');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/admin');
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      toast.error('Ingresa un correo electrónico válido', {
        style: { background: '#141414', color: '#fff' },
      });
      return;
    }
    setLoading(true);
    try {
      await signIn(trimmedEmail, password);
      toast.success('¡Bienvenido de nuevo!', {
        style: { background: '#141414', color: '#fff', border: '1px solid #C9A84C33' },
      });
      navigate('/admin');
    } catch (e: any) {
      toast.error(`Error al iniciar sesión: ${e.message}`, {
        style: { background: '#141414', color: '#fff' },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-[#C9A84C] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-8 h-8 text-[#0A0A0A]" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Prime <span className="text-[#C9A84C]">&amp;</span> Rare
            </h1>
            <p className="text-white/40 text-sm mt-1">Panel de Administración</p>
          </div>

          {/* Tarjeta */}
          <div className="bg-[#141414] border border-white/5 rounded-3xl p-8">
            <h2 className="text-white font-semibold text-lg mb-6">Iniciar Sesión</h2>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-white/60 text-xs mb-1.5">Correo Electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-white/10 text-white rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-[#C9A84C]/50 placeholder-white/20"
                    placeholder="admin@primeandare.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/60 text-xs mb-1.5">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-white/10 text-white rounded-xl pl-11 pr-12 py-3.5 text-sm focus:outline-none focus:border-[#C9A84C]/50 placeholder-white/20"
                    placeholder="Ingresa tu contraseña"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#C9A84C] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#D4AF37] transition-colors disabled:opacity-60 text-sm"
              >
                {loading ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>

          <div className="text-center mt-6 space-y-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 w-full py-3 border border-white/10 text-white/60 rounded-xl text-sm hover:bg-white/5 hover:text-white transition-colors"
            >
              <Home className="w-4 h-4" />
              Volver al inicio
            </Link>
            <p className="text-white/20 text-xs">
              Credenciales: admin@primeandare.com / PrimeRare2024!
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
