import { useMemo } from 'react'
import { CalendarX } from 'lucide-react'
import type { CalendarEvent } from '../lib/googleCalendar'
import type { EventExtras } from '../lib/posters'
import { EventCard } from './EventCard'
import { groupByMonth, monthAnchorId } from '../lib/dates'

interface AgendaListProps {
  events: CalendarEvent[]
  extrasOf: (eventId: string) => EventExtras
  onSelectEvent: (event: CalendarEvent) => void
  emptyText?: string
  /** Ordine scelto dal lettore (alfabetico, ultimi aggiunti): gli eventi
   *  arrivano già ordinati e i mesi non c'entrano più niente. */
  flat?: boolean
}

/** Elenco fatto in casa al posto di quello di FullCalendar: qui ci stanno la
 *  miniatura della locandina, i timbri di stato e le sagre lunghe raccontate
 *  per intero, cose che la vista `listMonth` non sa disegnare. */
export function AgendaList({ events, extrasOf, onSelectEvent, emptyText, flat }: AgendaListProps) {
  const months = useMemo(() => (flat ? [] : groupByMonth(events)), [events, flat])

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <CalendarX size={26} className="text-ink-faint" />
        <p className="max-w-xs text-sm text-ink-soft">
          {emptyText ?? 'Nessun appuntamento in cartellone con questi filtri.'}
        </p>
      </div>
    )
  }

  if (flat) {
    return (
      <ul className="space-y-2">
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} extras={extrasOf(event.id)} onSelect={onSelectEvent} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-7">
      {months.map((month) => (
        <section key={month.key}>
          {/* Testata di mese come il taglio alto di una pagina di giornale. */}
          {/* Si incolla sotto la testata e sotto l'indice dei mesi, qualunque
              altezza abbiano: `--rail-h` vale 0 quando l'indice non c'è. */}
          <div
            id={monthAnchorId(month.key)}
            style={{ scrollMarginTop: 'calc(var(--header-h) + var(--rail-h, 0px) + 0.75rem)' }}
            className="sticky top-[calc(var(--header-h)+var(--rail-h,0px)+0.25rem)] z-10 -mx-1 flex items-baseline justify-between gap-3 border-b-2 border-ink bg-paper-hi px-1 pt-1 pb-1.5 backdrop-blur-sm"
          >
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
