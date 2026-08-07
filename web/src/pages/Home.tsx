import { useMemo, useState, type ReactNode } from 'react'
import { RefreshCw, AlertTriangle, MapPin, ArrowRight } from 'lucide-react'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { CalendarView } from '../components/CalendarView'
import { EventModal } from '../components/EventModal'
import { DateRange } from '../components/DateRange'
import { categorize } from '../lib/categorize'
import { eventStart, eventEndExclusive, isOngoing, formatDuration, isMultiDay } from '../lib/dates'
import type { CalendarEvent } from '../lib/googleCalendar'

const CATEGORIES = [
  { label: 'Sagra', color: '#C8321E' },
  { label: 'Musica', color: '#6E1F3C' },
  { label: 'Mercato', color: '#8A6A0A' },
  { label: 'Sport', color: '#41601F' },
  { label: 'Spettacolo', color: '#7A3B78' },
  { label: 'Natale', color: '#175B6B' },
]

export function Home() {
  const { events, loading, error, reload } = useCalendarEvents()
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  /* Una sagra già iniziata ma non ancora finita resta la più rilevante:
     va in testa, non scartata come "passata". */
  const nextEvent = useMemo(() => {
    const now = new Date()
    return (
      [...events]
        .filter((e) => eventEndExclusive(e) > now)
        .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())[0] ?? null
    )
  }, [events])

  const nextOngoing = nextEvent ? isOngoing(nextEvent) : false

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      {/* ------------------------------------------------------ manifesto -- */}
      <section className="relative animate-ink-rise pt-10 pb-8">
        <div className="halftone pointer-events-none absolute -top-2 right-0 h-40 w-40 sm:h-56 sm:w-56" aria-hidden />

        <p className="eyebrow">Calendario popolare · Edizione locale</p>

        <h1 className="mt-3 font-display text-[3.25rem] leading-[0.86] font-black tracking-[-0.03em] text-ink sm:text-[5.5rem]">
          Eventi
          <br />
          <span className="font-normal italic text-vermiglio">&amp;</span> Sagre
        </h1>

        <div className="rule-double mt-6" />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-md text-sm leading-relaxed text-ink-soft">
            Feste di piazza, mercatini e appuntamenti di paese. Il cartellone si aggiorna da solo,
            direttamente dal calendario condiviso.
          </p>
          <button
            onClick={reload}
            disabled={loading}
            className="stamp-btn flex shrink-0 items-center gap-2 bg-paper-hi px-3.5 py-2 text-[0.65rem] font-bold tracking-[0.14em] uppercase text-ink"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Aggiorna
          </button>
        </div>

        {/* Dati di tiratura, come il colophon di un manifesto. */}
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink/25 pt-4">
          <Stat label="Appuntamenti" value={loading ? '—' : String(events.length)} />
          <Stat label="Prossimo" value={nextEvent ? <DateRange event={nextEvent} /> : '—'} />
          <Stat label="Fonte" value="Google Calendar" />
        </dl>
      </section>

      {/* ------------------------------------------------- prossima festa -- */}
      {nextEvent && !loading && (
        <button
          onClick={() => setSelected(nextEvent)}
          style={{ animationDelay: '90ms' }}
          className="ink-box group mb-8 flex w-full animate-ink-rise items-stretch overflow-hidden text-left transition-transform hover:translate-x-[1px] hover:translate-y-[1px]"
        >
          <span
            className="w-2 shrink-0"
            style={{ backgroundColor: categorize(nextEvent.title, nextEvent.description).color }}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="eyebrow">{nextOngoing ? 'In corso ora' : 'In arrivo'}</span>
                {nextOngoing && <span className="h-1.5 w-1.5 rounded-full bg-vermiglio" aria-hidden />}
              </span>
              <span className="mt-1 block truncate font-display text-xl font-black text-ink sm:text-2xl">
                {nextEvent.title}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                {nextEvent.location && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{nextEvent.location}</span>
                  </span>
                )}
                {isMultiDay(nextEvent) && (
                  <span className="font-semibold whitespace-nowrap">{formatDuration(nextEvent)} di festa</span>
                )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <DateRange
                event={nextEvent}
                className="font-display text-lg font-black whitespace-nowrap text-vermiglio"
              />
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </span>
          </span>
        </button>
      )}

      {error && (
        <div className="mb-6 flex items-start gap-2.5 border-2 border-vermiglio bg-vermiglio/10 p-4 text-sm text-ink">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-vermiglio" />
          <span>{error}</span>
        </div>
      )}

      {/* ------------------------------------------------------ cartellone -- */}
      <section style={{ animationDelay: '160ms' }} className="animate-ink-rise">
        {loading ? (
          <div className="ink-box p-4">
            <div className="mb-4 h-8 w-1/3 animate-pulse bg-paper-3" />
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 35 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse bg-paper-2"
                  style={{ animationDelay: `${(i % 7) * 60}ms` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <CalendarView events={events} onSelectEvent={setSelected} />
        )}
      </section>

      {/* --------------------------------------------------------- legenda -- */}
      <section style={{ animationDelay: '240ms' }} className="mt-8 animate-ink-rise">
        <p className="eyebrow">Legenda dei colori</p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {CATEGORIES.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <span
                className="h-3 w-3 border border-ink"
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              {c.label}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-12 border-t-2 border-ink pt-4">
        <p className="eyebrow">
          Stampato in proprio · Le locandine sono caricate dall'organizzatore
        </p>
      </footer>

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-black text-ink">{value}</dd>
    </div>
  )
}
