import { useEvents } from '../context/EventsContext'
import type { MatchEvent } from '../types'
import styles from './UpcomingMatches.module.css'

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
  return d.toLocaleDateString('es-CO', options)
}

export function UpcomingMatches() {
  const { matches } = useEvents()

  if (matches.length === 0) {
    return (
      <aside className={styles.aside}>
        <h3>Próximos partidos</h3>
        <p className={styles.empty}>No hay partidos programados.</p>
      </aside>
    )
  }

  return (
    <aside className={styles.aside}>
      <h3>Próximos partidos</h3>
      <ul className={styles.list}>
        {(matches as MatchEvent[]).map((m) => (
          <li key={m.id} className={styles.item}>
            <span className={styles.date}>{formatDisplayDate(m.date)}</span>
            {m.startTime && <span className={styles.time}>{m.startTime}</span>}
            <span className={styles.match}>
              {m.homeTeam === 'Millonarios F.C.' ? (
                <strong>Millonarios</strong>
              ) : (
                m.homeTeam
              )}{' '}
              vs{' '}
              {m.awayTeam === 'Millonarios F.C.' ? (
                <strong>Millonarios</strong>
              ) : (
                m.awayTeam
              )}
            </span>
            {m.competition && <span className={styles.comp}>{m.competition}</span>}
          </li>
        ))}
      </ul>
    </aside>
  )
}
