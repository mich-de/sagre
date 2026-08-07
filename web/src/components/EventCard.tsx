import { MapPin, Star, Image as ImageIcon, CalendarRange, ChevronRight } from 'lucide-react'
import type { CalendarEvent } from '../lib/googleCalendar'
import type { EventExtras } from '../lib/posters'
import { categorize } from '../lib/categorize'
import { DateRange } from './DateRange'
import { eventStart, formatDuration, isMultiDay, isOngoing, isOver, startTime } from '../lib/dates'

interface EventCardProps {
  event: CalendarEvent
  extras: EventExtras
  onSelect: (event: CalendarEvent) => void
  /** Nel riquadro "oggi e domani" la data è già nell'intestazione. */
  hideDate?: boolean
}

const MONTH = (d: Date) => d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')

/** Riga di cartellone: fascetta di categoria, miniatura, data cubitale.
 *  La usano l'elenco su misura e il riquadro di oggi e domani. */
export function EventCard({ event, extras, onSelect, hideDate }: EventCardProps) {
  const category = categorize(event.title, event.description, extras.category)
  const start = eventStart(event)
  const ongoing = isOngoing(event)
  const over = isOver(event)
  const cancelled = extras.status === 'annullato'
  const time = startTime(event)

  return (
    <button
      onClick={() => onSelect(event)}
      className={`group flex w-full items-stretch border-2 border-ink bg-paper-hi text-left shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] ${
        over && !ongoing ? 'opacity-60' : ''
      }`}
    >
      <span className="w-1.5 shrink-0" style={{ backgroundColor: category.color }} aria-hidden />

      {!hideDate && (
        <span className="flex w-14 shrink-0 flex-col items-center justify-center border-r-2 border-ink/15 py-2">
          <span className="font-display text-2xl leading-none font-black text-ink">{start.getDate()}</span>
          <span className="mt-0.5 text-[0.55rem] font-bold tracking-[0.16em] uppercase text-ink-faint">
            {MONTH(start)}
          </span>
        </span>
      )}

      {extras.thumb && (
        <span className="hidden w-16 shrink-0 overflow-hidden border-r-2 border-ink/15 sm:block">
          <img src={extras.thumb} alt="" className="h-full w-full object-cover" />
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2.5">
        <span className="flex flex-wrap items-center gap-1.5">
          {ongoing && !cancelled && (
            <span className="flex items-center gap-1 border border-ink bg-vermiglio px-1.5 py-px text-[0.55rem] font-bold tracking-[0.14em] uppercase text-paper-hi">
              <span className="h-1 w-1 rounded-full bg-paper-hi" aria-hidden />
              In corso
            </span>
          )}
          {cancelled && (
            <span className="border border-ink bg-ink px-1.5 py-px text-[0.55rem] font-bold tracking-[0.14em] uppercase text-paper-hi">
              Annullato
            </span>
          )}
          {extras.status === 'rinviato' && (
            <span className="border border-ink bg-paper-3 px-1.5 py-px text-[0.55rem] font-bold tracking-[0.14em] uppercase text-ink">
              Rinviato
            </span>
          )}
          {extras.featured && (
            <span className="flex items-center gap-1 border border-ink bg-paper-2 px-1.5 py-px text-[0.55rem] font-bold tracking-[0.14em] uppercase text-ink">
              <Star size={9} />
              In evidenza
            </span>
          )}
          <span
            className="border border-ink/20 px-1.5 py-px text-[0.55rem] font-bold tracking-[0.14em] uppercase"
            style={{ color: category.color }}
          >
            {category.label}
          </span>
        </span>

        <span
          className={`truncate font-display text-base leading-tight font-black text-ink sm:text-lg ${
            cancelled ? 'line-through decoration-vermiglio decoration-2' : ''
          }`}
        >
          {event.title}
        </span>

        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.7rem] text-ink-soft">
          {time && <span className="font-semibold tabular-nums">{time}</span>}
          {hideDate && !time && <span className="font-semibold">Tutto il giorno</span>}
          {!hideDate && isMultiDay(event) && (
            <span className="flex items-center gap-1 whitespace-nowrap">
              <CalendarRange size={11} />
              {formatDuration(event)}
            </span>
          )}
          {event.location && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
          {extras.thumb && (
            <span className="flex items-center gap-1 text-ink-faint sm:hidden">
              <ImageIcon size={11} />
              Locandina
            </span>
          )}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-2 pr-3">
        {isMultiDay(event) && !hideDate && (
          <DateRange
            event={event}
            className="hidden font-display text-sm font-black whitespace-nowrap text-ink-faint lg:block"
          />
        )}
        <ChevronRight size={16} className="text-ink-faint transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}
