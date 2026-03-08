export type ViewMode = 'month' | 'week' | 'day'

export interface CalendarEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  startTime?: string // HH:mm
  endTime?: string
  description?: string
  type: 'meeting' | 'event' | 'match'
}

export interface MatchEvent extends CalendarEvent {
  type: 'match'
  homeTeam: string
  awayTeam: string
  competition?: string
  venue?: string
}

export function isMatchEvent(e: CalendarEvent): e is MatchEvent {
  return e.type === 'match'
}
