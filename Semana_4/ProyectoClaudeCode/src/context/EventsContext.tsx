import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getUpcomingMatches } from '../data/millonariosMatches'
import type { CalendarEvent } from '../types'

const STORAGE_KEY = 'millonarios_calendar_events'

function loadCustomEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCustomEvents(events: CalendarEvent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  } catch {
    //
  }
}

interface EventsContextType {
  customEvents: CalendarEvent[]
  matches: CalendarEvent[]
  allEvents: CalendarEvent[]
  addEvent: (e: Omit<CalendarEvent, 'id'>) => void
  updateEvent: (id: string, e: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
  getEventsForDay: (date: string) => CalendarEvent[]
}

const EventsContext = createContext<EventsContextType | null>(null)

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>(loadCustomEvents)
  const matches = getUpcomingMatches()

  useEffect(() => {
    saveCustomEvents(customEvents)
  }, [customEvents])

  const allEvents = [...matches, ...customEvents]

  const addEvent = useCallback((e: Omit<CalendarEvent, 'id'>) => {
    const id = 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    setCustomEvents((prev) => [...prev, { ...e, id }])
  }, [])

  const updateEvent = useCallback((id: string, patch: Partial<CalendarEvent>) => {
    setCustomEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, ...patch } : ev))
    )
  }, [])

  const deleteEvent = useCallback((id: string) => {
    setCustomEvents((prev) => prev.filter((ev) => ev.id !== id))
  }, [])

  const getEventsForDay = useCallback(
    (date: string) => {
      return allEvents.filter((ev) => ev.date === date)
    },
    [allEvents]
  )

  return (
    <EventsContext.Provider
      value={{
        customEvents,
        matches,
        allEvents,
        addEvent,
        updateEvent,
        deleteEvent,
        getEventsForDay,
      }}
    >
      {children}
    </EventsContext.Provider>
  )
}

export function useEvents() {
  const ctx = useContext(EventsContext)
  if (!ctx) throw new Error('useEvents must be used within EventsProvider')
  return ctx
}
