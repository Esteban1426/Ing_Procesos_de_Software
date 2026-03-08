import { useAuth } from '../context/AuthContext'
import styles from './Header.module.css'

interface HeaderProps {
  onLoginClick: () => void
}

export function Header({ onLoginClick }: HeaderProps) {
  const { isAdmin, logout } = useAuth()

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img
          src="/Escudo_de_Millonarios_FC.svg"
          alt="Millonarios F.C."
          className={styles.crest}
        />
        <div>
          <h1 className={styles.title}>Calendario Millonarios F.C.</h1>
          <p className={styles.subtitle}>Partidos y eventos</p>
        </div>
      </div>
      <div className={styles.actions}>
        {isAdmin ? (
          <button type="button" className={styles.logoutBtn} onClick={logout}>
            Cerrar sesión
          </button>
        ) : (
          <button type="button" className={styles.loginBtn} onClick={onLoginClick}>
            Iniciar sesión
          </button>
        )}
      </div>
    </header>
  )
}
