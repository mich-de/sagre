import { useMemo } from 'react'
import { CalendarX } from 'lucide-react'
import type { CalendarEvent } from '../lib/googleCalendar'
import type { EventExtras } from '../lib/posters'
import { EventCard } from './EventCard'
import { eventStart, monthKey, monthLabel } from '../lib/dates'

interface AgendaListProps {
  events: CalendarEvent[]
  extrasOf: (eventId: string) => EventExtras
  onSelectEvent: (event: CalendarEvent) => void
  emptyText?: string
}

/** Elenco fatto in casa al posto di quello di FullCalendar: qui ci stanno la
 *  miniatura della locandina, i timbri di stato e le sagre lunghe raccontate
 *  per intero, cose che la vista `listMonth` non sa disegnare. */
export function AgendaList({ events, extrasOf, onSelectEvent, emptyText }: AgendaListProps) {
  const months = useMemo(() => {
    const sorted = [...events].sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
    const groups: Array<{ key: string; label: string; events: CalendarEvent[] }> = []
    for (const event of sorted) {
      const start = eventStart(event)
      const key = monthKey(start)
      const last = groups[groups.length - 1]
      if (last?.key === key) last.events.push(event)
      else groups.push({ key, label: monthLabel(start), events: [event] })
    }
    return groups
  }, [events])

  if (months.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <CalendarX size={26} className="text-ink-faint" />
        <p className="max-w-xs text-sm text-ink-soft">
          {emptyText ?? 'Nessun appuntamento in cartellone con questi filtri.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      {months.map((month) => (
        <section key={month.key}>
          {/* Testata di mese come il taglio alto di una pagina di giornale. */}
          <div className="sticky top-[7.5rem] z-10 -mx-1 flex items-baseline justify-between gap-3 border-b-2 border-ink bg-paper-hi px-1 pt-1 pb-1.5 backdrop-blur-sm">
            <h3 className="font-display text-lg leading-none font-black text-ink sm:text-xl">
              {month.label}
            </h3>
            <span className="eyebrow shrink-0">
              {month.events.length} {month.events.length === 1 ? 'appuntamento' : 'appuntamenti'}
            </span>
          </div>

          <ul className="mt-3 space-y-2">
            {month.events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} extras={extrasOf(event.id)} onSelect={onSelectEvent} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
