import React, { createContext, useContext, useState, useEffect } from 'react';
import { adminLogin, adminLogout, getAdminSession, AdminUser } from '../lib/localDB';

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sesión guardada en localStorage
    const session = getAdminSession();
    setUser(session);
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    const loggedIn = adminLogin(email, password);
    if (!loggedIn) {
      throw new Error('Correo o contraseña incorrectos');
    }
    setUser(loggedIn);
  };

  const signOut = async (): Promise<void> => {
    adminLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
