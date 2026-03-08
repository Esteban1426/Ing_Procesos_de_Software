import type { MatchEvent } from '../types'

export const MILLONARIOS_MATCHES: MatchEvent[] = [
  {
    id: 'm1',
    type: 'match',
    title: 'Millonarios vs Rival',
    date: '2025-03-15',
    startTime: '20:00',
    homeTeam: 'Millonarios F.C.',
    awayTeam: 'Rival',
    competition: 'Liga BetPlay',
    venue: 'Estadio El Campín',
  },
  {
    id: 'm2',
    type: 'match',
    title: 'Visitante vs Millonarios',
    date: '2025-03-22',
    startTime: '18:00',
    homeTeam: 'Visitante',
    awayTeam: 'Millonarios F.C.',
    competition: 'Liga BetPlay',
    venue: 'Visitante',
  },
  {
    id: 'm3',
    type: 'match',
    title: 'Millonarios vs Otro Rival',
    date: '2025-04-05',
    startTime: '19:30',
    homeTeam: 'Millonarios F.C.',
    awayTeam: 'Otro Rival',
    competition: 'Copa Colombia',
    venue: 'Estadio El Campín',
  },
  {
    id: 'm4',
    type: 'match',
    title: 'Rival vs Millonarios',
    date: '2025-04-12',
    startTime: '20:00',
    homeTeam: 'Rival',
    awayTeam: 'Millonarios F.C.',
    competition: 'Liga BetPlay',
    venue: 'Visitante',
  },
  {
    id: 'm5',
    type: 'match',
    title: 'Millonarios vs Clásico',
    date: '2025-04-20',
    startTime: '19:00',
    homeTeam: 'Millonarios F.C.',
    awayTeam: 'Clásico',
    competition: 'Liga BetPlay',
    venue: 'Estadio El Campín',
  },
]

function isUpcoming(dateStr: string): boolean {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d >= today
}

export function getUpcomingMatches(): MatchEvent[] {
  return MILLONARIOS_MATCHES.filter((m) => isUpcoming(m.date))
}
