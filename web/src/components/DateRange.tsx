import type { CalendarEvent } from '../lib/googleCalendar'
import { shortRangeParts } from '../lib/dates'

interface DateRangeProps {
  event: CalendarEvent
  className?: string
}

/* Il trattino di Bodoni Moda è un capello: a corpo titolo scompare e "5-7 ago"
   si legge "5 7 ago". Il separatore viene quindi disegnato a parte, con il font
   di testo e in rosso — resta leggibile e diventa un dettaglio voluto. */
export function DateRange({ event, className }: DateRangeProps) {
  const { from, to } = shortRangeParts(event)
  if (!to) return <span className={className}>{from}</span>
  return (
    <span className={className}>
      {from}
      <span className="mx-[0.16em] font-body font-bold text-vermiglio" aria-hidden>
        –
      </span>
      <span className="sr-only"> a </span>
      {to}
    </span>
  )
}
