import { useCallback, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import styles from './LoginModal.module.css'

interface LoginModalProps {
  open: boolean
  onClose: () => void
}

export function LoginModal({ open, onClose }: LoginModalProps) {
  const { login } = useAuth()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setError('')
      if (login(user, password)) {
        setUser('')
        setPassword('')
        onClose()
      } else {
        setError('Usuario o contraseña incorrectos.')
      }
    },
    [user, password, login, onClose]
  )

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.crestWrap}>
          <img src="/Escudo_de_Millonarios_FC.svg" alt="Millonarios" className={styles.crest} />
        </div>
        <h2>Iniciar sesión (admin)</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label>
            Usuario
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
              placeholder="admin"
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitBtn}>
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
