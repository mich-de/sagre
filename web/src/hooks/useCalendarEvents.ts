import { useEffect, useState } from 'react'
import { fetchUpcomingEvents, type CalendarEvent } from '../lib/googleCalendar'

interface UseCalendarEventsResult {
  events: CalendarEvent[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchUpcomingEvents()
      .then((data) => {
        if (!cancelled) setEvents(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  return { events, loading, error, reload: () => setReloadKey((k) => k + 1) }
}
