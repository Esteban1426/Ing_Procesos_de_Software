import { useCallback, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useEvents } from '../context/EventsContext'
import type { CalendarEvent, ViewMode } from '../types'
import {
  formatDateKey,
  getMonthDays,
  getMonthName,
  isCurrentMonth,
  isToday,
} from '../utils/dateUtils'
import { EventModal } from './EventModal'
import styles from './Calendar.module.css'

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function Calendar() {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  const { isAdmin } = useAuth()
  const { getEventsForDay, deleteEvent } = useEvents()

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const days = getMonthDays(year, month)

  const goPrev = useCallback(() => {
    if (viewMode === 'month') {
      setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
    } else if (viewMode === 'week') {
      setViewDate((d) => {
        const n = new Date(d)
        n.setDate(n.getDate() - 7)
        return n
      })
    } else {
      setViewDate((d) => {
        const n = new Date(d)
        n.setDate(n.getDate() - 1)
        return n
      })
    }
  }, [viewMode])

  const goNext = useCallback(() => {
    if (viewMode === 'month') {
      setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))
    } else if (viewMode === 'week') {
      setViewDate((d) => {
        const n = new Date(d)
        n.setDate(n.getDate() + 7)
        return n
      })
    } else {
      setViewDate((d) => {
        const n = new Date(d)
        n.setDate(n.getDate() + 1)
        return n
      })
    }
  }, [viewMode])

  const goToday = useCallback(() => {
    setViewDate(new Date())
  }, [])

  const handleDayClick = useCallback((date: Date) => {
    setViewDate(date)
    setSelectedEvent(null)
  }, [])

  const handleEventClick = useCallback((e: CalendarEvent, ev: React.MouseEvent) => {
    ev.stopPropagation()
    setSelectedEvent(e)
  }, [])

  const openNewEvent = useCallback((date: string) => {
    setEditingEvent({
      id: '',
      title: '',
      date,
      type: 'event',
    })
    setEventModalOpen(true)
  }, [])

  const closeEventModal = useCallback(() => {
    setEventModalOpen(false)
    setEditingEvent(null)
  }, [])

  return (
    <section className={styles.calendarSection}>
      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <button type="button" className={styles.navBtn} onClick={goPrev} aria-label="Anterior">
            ‹
          </button>
          <button type="button" className={styles.todayBtn} onClick={goToday}>
            Hoy
          </button>
          <button type="button" className={styles.navBtn} onClick={goNext} aria-label="Siguiente">
            ›
          </button>
        </div>
        <h2 className={styles.monthTitle}>
          {getMonthName(month)} {year}
        </h2>
        {isAdmin && (
          <button
            type="button"
            className={styles.addEventBtn}
            onClick={() => {
            setEditingEvent({ id: '', title: '', date: formatDateKey(viewDate), type: 'event' })
            setEventModalOpen(true)
          }}
          >
            + Añadir evento
          </button>
        )}
        <div className={styles.viewTabs}>
          <button
            type="button"
            className={viewMode === 'month' ? styles.tabActive : styles.tab}
            onClick={() => setViewMode('month')}
          >
            Mes
          </button>
          <button
            type="button"
            className={viewMode === 'week' ? styles.tabActive : styles.tab}
            onClick={() => setViewMode('week')}
          >
            Semana
          </button>
          <button
            type="button"
            className={viewMode === 'day' ? styles.tabActive : styles.tab}
            onClick={() => setViewMode('day')}
          >
            Día
          </button>
        </div>
      </div>

      {viewMode === 'month' && (
        <div className={styles.monthGrid}>
          {WEEKDAYS.map((w) => (
            <div key={w} className={styles.weekdayHead}>
              {w}
            </div>
          ))}
          {days.map((d, i) => {
            const key = formatDateKey(d)
            const events = getEventsForDay(key)
            const current = isCurrentMonth(d, year, month)
            const today = isToday(d)

            return (
              <div
                key={i}
                className={`${styles.dayCell} ${!current ? styles.otherMonth : ''} ${today ? styles.today : ''}`}
                onClick={() => handleDayClick(d)}
              >
                <div className={styles.dayNumber}>{d.getDate()}</div>
                <div className={styles.dayEvents}>
                  {events.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      className={`${styles.eventChip} ${ev.type === 'match' ? styles.matchChip : styles.customChip}`}
                      onClick={(e) => handleEventClick(ev, e)}
                    >
                      {ev.type === 'match' ? '⚽' : '•'} {ev.title.slice(0, 12)}
                      {ev.title.length > 12 ? '…' : ''}
                    </button>
                  ))}
                  {events.length > 3 && (
                    <span className={styles.more}>+{events.length - 3}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewMode === 'week' && (() => {
        const mondayOffset = (viewDate.getDay() + 6) % 7
        const weekStart = new Date(viewDate)
        weekStart.setDate(viewDate.getDate() - mondayOffset)
        return (
        <div className={styles.weekView}>
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart)
            d.setDate(weekStart.getDate() + i)
            const key = formatDateKey(d)
            const events = getEventsForDay(key)
            const today = isToday(d)
            return (
              <div key={key} className={`${styles.weekDay} ${today ? styles.today : ''}`}>
                <div className={styles.weekDayLabel}>
                  {WEEKDAYS[i]} {d.getDate()}
                </div>
                <div className={styles.weekDayEvents}>
                  {events.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      className={`${styles.eventChip} ${ev.type === 'match' ? styles.matchChip : styles.customChip}`}
                      onClick={(e) => handleEventClick(ev, e)}
                    >
                      {ev.title}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        )
      })()}

      {viewMode === 'day' && (
        <div className={styles.dayView}>
          <div className={styles.dayViewLabel}>
            {viewDate.getDate()} {getMonthName(viewDate.getMonth())} {viewDate.getFullYear()}
          </div>
          <div className={styles.dayViewEvents}>
            {getEventsForDay(formatDateKey(viewDate)).map((ev) => (
              <button
                key={ev.id}
                type="button"
                className={`${styles.eventCard} ${ev.type === 'match' ? styles.matchChip : styles.customChip}`}
                onClick={(e) => handleEventClick(ev, e)}
              >
                <strong>{ev.title}</strong>
                {ev.startTime && <span>{ev.startTime}</span>}
                {ev.description && <p>{ev.description}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedEvent && (
        <div
          className={styles.backdrop}
          onClick={() => setSelectedEvent(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setSelectedEvent(null)}
          aria-label="Cerrar"
        >
          <div className={styles.popover} onClick={(e) => e.stopPropagation()}>
            <h3>{selectedEvent.title}</h3>
            <p className={styles.popoverMeta}>
              {selectedEvent.date}
              {selectedEvent.startTime && ` · ${selectedEvent.startTime}`}
            </p>
            {selectedEvent.description && <p>{selectedEvent.description}</p>}
            {selectedEvent.type === 'match' && 'homeTeam' in selectedEvent && (
              <p className={styles.matchInfo}>
                {selectedEvent.venue} · {selectedEvent.competition}
              </p>
            )}
            <div className={styles.popoverActions}>
              {isAdmin && selectedEvent.type !== 'match' && (
                <>
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => {
                      setEditingEvent(selectedEvent)
                      setEventModalOpen(true)
                      setSelectedEvent(null)
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => {
                      deleteEvent(selectedEvent.id)
                      setSelectedEvent(null)
                    }}
                  >
                    Eliminar
                  </button>
                </>
              )}
              <button type="button" className={styles.closePopover} onClick={() => setSelectedEvent(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <EventModal
        open={eventModalOpen}
        event={editingEvent}
        onClose={closeEventModal}
        onSaved={closeEventModal}
      />
    </section>
  )
}
