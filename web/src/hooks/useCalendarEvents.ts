/* ---------------------------------------------------------------------------
 * L'elenco degli eventi, letto da Google con la sola chiave API.
 *
 * Scrittura e lettura non passano dalla stessa porta: si crea un evento con il
 * permesso OAuth, ma lo si rilegge dalla copia pubblica del calendario, che può
 * restare indietro di qualche secondo. Chi salvava una sagra e non se la vedeva
 * comparire pensava che il salvataggio fosse fallito, e lo rifaceva.
 *
 * Perciò le scritture appena fatte restano qui da parte e vengono sovrapposte
 * all'elenco letto, finché la lettura non le raggiunge. La risposta di Google
 * alla scrittura è l'evento vero: fino a prova contraria vince lei.
 * ------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchUpcomingEvents, type CalendarEvent } from '../lib/googleCalendar'
import { eventStart } from '../lib/dates'

interface UseCalendarEventsResult {
  events: CalendarEvent[]
  loading: boolean
  error: string | null
  reload: () => void
  /** Un evento appena creato o modificato: compare subito nell'elenco. */
  applyWrite: (event: CalendarEvent) => void
  /** Un evento appena cancellato: sparisce subito dall'elenco. */
  applyDelete: (eventId: string) => void
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const [fetched, setFetched] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  /* Scritture in attesa che la lettura pubblica le rispecchi. */
  const [written, setWritten] = useState<Record<string, CalendarEvent>>({})
  const [erased, setErased] = useState<Record<string, true>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchUpcomingEvents()
      .then((data) => {
        if (cancelled) return
        setFetched(data)

        /* Riconciliazione: si lascia andare la copia locale solo quando quella
           letta è aggiornata almeno quanto lei. `updated` è il timbro che mette
           Google, quindi il confronto regge anche fra orologi diversi. */
        const live = new Map(data.map((e) => [e.id, e]))
        setWritten((prev) => {
          const next: Record<string, CalendarEvent> = {}
          let changed = false
          for (const [id, mine] of Object.entries(prev)) {
            const theirs = live.get(id)
            if (theirs && theirs.updated >= mine.updated) changed = true
            else next[id] = mine
          }
          return changed ? next : prev
        })
        setErased((prev) => {
          const next: Record<string, true> = {}
          let changed = false
          for (const id of Object.keys(prev)) {
            if (live.has(id)) next[id] = true
            else changed = true
          }
          return changed ? next : prev
        })
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

  const events = useMemo(() => {
    const merged = fetched.filter((e) => !erased[e.id]).map((e) => written[e.id] ?? e)

    /* Gli eventi nuovi non sono ancora nell'elenco letto: si aggiungono in
       coda, e solo allora si riordina — l'elenco arriva già ordinato da
       Google, e rimescolarlo a ogni giro non servirebbe a nulla. */
    const known = new Set(fetched.map((e) => e.id))
    const fresh = Object.values(written).filter((e) => !known.has(e.id))
    if (fresh.length === 0) return merged

    return [...merged, ...fresh].sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
  }, [fetched, written, erased])

  const applyWrite = useCallback((event: CalendarEvent) => {
    setWritten((prev) => ({ ...prev, [event.id]: event }))
    setErased((prev) => {
      if (!prev[event.id]) return prev
      const next = { ...prev }
      delete next[event.id]
      return next
    })
  }, [])

  const applyDelete = useCallback((eventId: string) => {
    setErased((prev) => ({ ...prev, [eventId]: true }))
    setWritten((prev) => {
      if (!prev[eventId]) return prev
      const next = { ...prev }
      delete next[eventId]
      return next
    })
  }, [])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  return { events, loading, error, reload, applyWrite, applyDelete }
}
