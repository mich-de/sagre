import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DatesSetArg, EventClickArg, EventContentArg, EventMountArg } from '@fullcalendar/core'
import itLocale from '@fullcalendar/core/locales/it'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import type { CalendarEvent } from '../lib/googleCalendar'
import type { EventExtras } from '../lib/posters'
import { categorize } from '../lib/categorize'
import {
  NEXT_DAY_THRESHOLD,
  eventEndInclusive,
  eventStart,
  formatDateRange,
  monthKey,
  monthLabel,
  startOfDay,
} from '../lib/dates'

interface CalendarViewProps {
  events: CalendarEvent[]
  extrasOf: (eventId: string) => EventExtras
  onSelectEvent: (event: CalendarEvent) => void
}

const DAY_MS = 86_400_000

export function CalendarView({ events, extrasOf, onSelectEvent }: CalendarViewProps) {
  const ref = useRef<FullCalendar | null>(null)
  const [current, setCurrent] = useState(() => new Date())

  const fcEvents = useMemo(
    () =>
      events.map((e) => {
        const extras = extrasOf(e.id)
        const category = categorize(e.title, e.description, extras.category)
        return {
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          allDay: e.allDay,
          backgroundColor: category.color,
          borderColor: category.color,
          textColor: '#FBF6EA',
          classNames: extras.status === 'annullato' ? ['is-cancelled'] : [],
          extendedProps: { thumb: extras.thumb, featured: extras.featured, status: extras.status },
        }
      }),
    [events, extrasOf]
  )

  /* Quante feste per giorno: serve al contatore in alto a destra nella cella.
     Le sagre lunghe contano in ognuno dei giorni che occupano. */
  const perDay = useMemo(() => {
    const counts = new Map<number, number>()
    for (const e of events) {
      let day = startOfDay(eventStart(e)).getTime()
      const last = startOfDay(eventEndInclusive(e)).getTime()
      while (day <= last) {
        counts.set(day, (counts.get(day) ?? 0) + 1)
        day += DAY_MS
      }
    }
    return counts
  }, [events])

  const go = useCallback((action: 'prev' | 'next' | 'today') => {
    const api = ref.current?.getApi()
    if (!api) return
    if (action === 'prev') api.prev()
    else if (action === 'next') api.next()
    else api.today()
  }, [])

  /* Frecce della tastiera per sfogliare i mesi, ma non mentre si scrive in un
     campo: lì le frecce servono a muovere il cursore. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return
      if (document.querySelector('[role="dialog"]')) return
      go(e.key === 'ArrowLeft' ? 'prev' : 'next')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [go])

  function handleEventClick(arg: EventClickArg) {
    const found = events.find((e) => e.id === arg.event.id)
    if (found) onSelectEvent(found)
  }

  /* Anteprima al passaggio del mouse: data distesa, luogo e stato, senza
     dover aprire la scheda. */
  function handleEventMount(arg: EventMountArg) {
    const source = events.find((e) => e.id === arg.event.id)
    if (!source) return
    const extras = extrasOf(source.id)
    const lines = [source.title, formatDateRange(source)]
    if (source.location) lines.push(`📍 ${source.location}`)
    if (extras.status !== 'confermato') lines.push(extras.status.toUpperCase())
    if (extras.note) lines.push(extras.note.slice(0, 140))
    arg.el.title = lines.join('\n')
  }

  /* Le sagre lunghe attraversano più righe della griglia: le frecce dicono
     da che parte il blocco continua, così una festa di quattro giorni non
     sembra quattro feste diverse. */
  function renderEventContent(arg: EventContentArg) {
    const { thumb, featured } = arg.event.extendedProps as { thumb: string | null; featured: boolean }
    return (
      <div className="flex w-full min-w-0 items-center gap-1 overflow-hidden px-1 py-0.5 text-[0.68rem] leading-tight font-semibold">
        {!arg.isStart && (
          <span className="shrink-0" aria-hidden>
            ‹
          </span>
        )}
        {arg.isStart && thumb && (
          <img src={thumb} alt="" className="h-3.5 w-3.5 shrink-0 border border-ink/40 object-cover" />
        )}
        {arg.isStart && featured && <Star size={9} className="shrink-0" fill="currentColor" />}
        {arg.isStart && !arg.event.allDay && arg.timeText && (
          <span className="shrink-0 tabular-nums opacity-75">{arg.timeText}</span>
        )}
        <span className="min-w-0 flex-1 truncate">{arg.event.title}</span>
        {!arg.isEnd && (
          <span className="shrink-0" aria-hidden>
            ›
          </span>
        )}
      </div>
    )
  }

  function renderDayCell(arg: { date: Date; dayNumberText: string }) {
    const count = perDay.get(startOfDay(arg.date).getTime()) ?? 0
    return (
      <div className="flex w-full items-center justify-between gap-1">
        {count > 0 ? (
          <span className="fc-day-count" title={`${count} in cartellone`}>
            {count}
          </span>
        ) : (
          <span />
        )}
        <span>{arg.dayNumberText}</span>
      </div>
    )
  }

  function handleDatesSet(arg: DatesSetArg) {
    /* `arg.start` è il primo giorno *visibile*, che spesso è di fine mese
       precedente: il mese vero sta a metà della finestra. */
    setCurrent(new Date(arg.start.getTime() + (arg.end.getTime() - arg.start.getTime()) / 2))
  }

  return (
    <div className="ink-box overflow-hidden">
      {/* Bandierine lungo il bordo superiore del cartellone. */}
      <div className="bunting" aria-hidden />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-3 py-2.5 sm:px-5">
        <div className="flex items-center gap-1.5">
          <NavBtn onClick={() => go('prev')} label="Mese precedente">
            <ChevronLeft size={15} />
          </NavBtn>
          <NavBtn onClick={() => go('next')} label="Mese successivo">
            <ChevronRight size={15} />
          </NavBtn>
          <button
            onClick={() => go('today')}
            className="stamp-btn bg-paper-hi px-2.5 py-1.5 text-[0.6rem] font-bold tracking-[0.12em] uppercase text-ink"
          >
            Oggi
          </button>
        </div>

        <h2 className="order-first w-full text-center font-display text-xl leading-none font-black text-ink sm:order-none sm:w-auto sm:text-2xl">
          {monthLabel(current)}
        </h2>

        {/* Salto rapido: il selettore nativo dei mesi è la scorciatoia più
            corta per arrivare a dicembre senza dodici clic. */}
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Vai al mese</span>
          <input
            type="month"
            value={monthKey(current)}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number)
              if (y && m) ref.current?.getApi().gotoDate(new Date(y, m - 1, 1))
            }}
            className="border-2 border-ink bg-paper-hi px-2 py-1 text-[0.68rem] font-semibold text-ink outline-none focus:ring-2 focus:ring-vermiglio"
          />
        </label>
      </div>

      <div className="p-3 sm:p-5">
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={itLocale}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          headerToolbar={false}
          height="auto"
          events={fcEvents}
          /* Tutti a blocco pieno: gli eventi con orario, lasciati al "puntino"
             predefinito, restavano testo nudo che tracimava nelle celle vicine. */
          eventDisplay="block"
          /* Una festa che finisce all'una di notte resta la festa della sera
             prima: stessa soglia usata da `eventEndInclusive`. */
          nextDayThreshold={NEXT_DAY_THRESHOLD}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          eventDidMount={handleEventMount}
          dayCellContent={renderDayCell}
          datesSet={handleDatesSet}
          dayMaxEvents={4}
          eventOrder="start,-duration,allDay,title"
          firstDay={1}
        />
      </div>
    </div>
  )
}

function NavBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="stamp-btn bg-paper-hi p-1.5 text-ink"
    >
      {children}
    </button>
  )
}
