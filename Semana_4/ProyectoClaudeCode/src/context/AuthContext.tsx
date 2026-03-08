import { createContext, useCallback, useContext, useState } from 'react'

const ADMIN_USER = 'Administrador'
const ADMIN_PASSWORD = '1426Esteban'

interface AuthContextType {
  isAdmin: boolean
  login: (user: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return sessionStorage.getItem('millonarios_admin') === '1'
    } catch {
      return false
    }
  })

  const login = useCallback((user: string, password: string) => {
    if (user === ADMIN_USER && password === ADMIN_PASSWORD) {
      sessionStorage.setItem('millonarios_admin', '1')
      setIsAdmin(true)
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem('millonarios_admin')
    setIsAdmin(false)
  }, [])

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
