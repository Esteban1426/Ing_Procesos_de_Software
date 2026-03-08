import { useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { EventsProvider } from './context/EventsContext'
import { Calendar } from './components/Calendar'
import { Header } from './components/Header'
import { LoginModal } from './components/LoginModal'
import { UpcomingMatches } from './components/UpcomingMatches'
import styles from './App.module.css'

function AppContent() {
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <div className={styles.app}>
      <Header onLoginClick={() => setLoginOpen(true)} />
      <main className={styles.main}>
        <Calendar />
        <UpcomingMatches />
      </main>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <EventsProvider>
        <AppContent />
      </EventsProvider>
    </AuthProvider>
  )
}
