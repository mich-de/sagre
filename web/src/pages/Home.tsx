import { useCallback, useMemo, type ReactNode } from 'react'
import {
  RefreshCw,
  AlertTriangle,
  MapPin,
  ArrowRight,
  Star,
  CalendarX,
  Printer,
  CalendarArrowDown,
} from 'lucide-react'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { useEventExtras } from '../hooks/useEventExtras'
import { useHomeFilters } from '../hooks/useHomeFilters'
import { CalendarView } from '../components/CalendarView'
import { AgendaList } from '../components/AgendaList'
import { EventCard } from '../components/EventCard'
import { EventModal } from '../components/EventModal'
import { DateRange } from '../components/DateRange'
import { FilterBar } from '../components/FilterBar'
import { MonthRail } from '../components/MonthRail'
import { NoResults } from '../components/NoResults'
import { BackToTop } from '../components/BackToTop'
import { PrintMasthead } from '../components/PrintMasthead'
import { downloadIcs, icsFileName } from '../lib/ics'
import { categorize, CATEGORIES } from '../lib/categorize'
import { inTimeRange, sortEvents } from '../lib/filters'
import { collectPlaces, inPlace } from '../lib/places'
import {
  addDays,
  eventStart,
  eventEndExclusive,
  groupByMonth,
  isOngoing,
  formatDuration,
  isMultiDay,
  occursOn,
} from '../lib/dates'
import type { CalendarEvent } from '../lib/googleCalendar'
import type { EventExtras } from '../lib/posters'

export function Home() {
  const { events, loading, error, reload } = useCalendarEvents()
  const { extrasOf, reload: reloadExtras } = useEventExtras()

  /* Filtri, vista e scheda aperta stanno nell'indirizzo: il link è
     condivisibile e il tasto indietro torna a quel che c'era prima. */
  const { filters, set, clear, filtering, eventId, openEvent, closeEvent } = useHomeFilters()
  const { query, categories, range, from, to, place, sort, view } = filters
  const setSelected = useCallback((event: CalendarEvent) => openEvent(event.id), [openEvent])

  const places = useMemo(() => collectPlaces(events), [events])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const kept = events.filter((event) => {
      const extras = extrasOf(event.id)
      if (
        categories.length > 0 &&
        !categories.includes(categorize(event.title, event.description, extras.category).key)
      ) {
        return false
      }
      if (q && !`${event.title} ${event.location} ${event.description}`.toLowerCase().includes(q)) {
        return false
      }
      if (place && !inPlace(event, place)) return false
      /* La finestra temporale vale solo per l'elenco: nella griglia il mese
         che si sta guardando è già la finestra. */
      if (view === 'list' && !inTimeRange(event, range, from, to)) return false
      return true
    })
    return view === 'list' ? sortEvents(kept, sort) : kept
  }, [events, extrasOf, categories, query, place, range, from, to, sort, view])

  /* Indice dei mesi: solo dove i mesi fanno ancora da capitolo, cioè
     nell'elenco in ordine cronologico, e solo se ce n'è più d'uno. */
  const months = useMemo(
    () => (view === 'list' && sort === 'prossimi' ? groupByMonth(filtered) : []),
    [filtered, view, sort]
  )

  /* La scheda aperta arriva dall'indirizzo, non da uno stato a parte: così un
     link condiviso apre già la sagra giusta. */
  const selected = useMemo(
    () => (eventId ? (events.find((e) => e.id === eventId) ?? null) : null),
    [events, eventId]
  )
  /* Si sfoglia il cartellone filtrato. Una sagra aperta da "oggi" o dalla
     testa del giornale può non starci dentro: lì le frecce non compaiono. */
  const navIndex = useMemo(
    () => (selected ? filtered.findIndex((e) => e.id === selected.id) : -1),
    [filtered, selected]
  )

  const today = useMemo(() => events.filter((e) => occursOn(e, new Date())), [events])
  const tomorrow = useMemo(() => events.filter((e) => occursOn(e, addDays(new Date(), 1))), [events])

  /* In cima va la festa segnalata dall'organizzatore; se non ce n'è, la
     prima in arrivo. Una sagra già iniziata ma non finita resta in testa. */
  const upcoming = useMemo(
    () =>
      [...events]
        .filter((e) => eventEndExclusive(e) > new Date())
        .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime()),
    [events]
  )
  const headline = useMemo(
    () => upcoming.find((e) => extrasOf(e.id).featured) ?? upcoming[0] ?? null,
    [upcoming, extrasOf]
  )
  const headlineFeatured = headline ? extrasOf(headline.id).featured : false
  const headlineOngoing = headline ? isOngoing(headline) : false

  return (
    <main className="page-x mx-auto max-w-5xl pb-[max(4rem,env(safe-area-inset-bottom))]">
      {/* Testata che compare solo sulla carta: dice che foglio è, di quando è
          e dove sta l'originale che si aggiorna da solo. */}
      <PrintMasthead filters={filters} shown={filtered.length} total={events.length} />

      {/* ------------------------------------------------------ manifesto -- */}
      {/* Sul foglio la testata la fa `PrintMasthead`: questa è tutta roba da
          dito e da schermo, e il titolo cubitale due volte sarebbe uno spreco
          di mezza pagina. */}
      <section className="no-print relative animate-ink-rise pt-10 pb-8">
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
            onClick={() => {
              reload()
              reloadExtras()
            }}
            disabled={loading}
            className="stamp-btn tap tap-grow flex shrink-0 items-center gap-2 bg-paper-hi px-3.5 py-2 text-[0.65rem] font-bold tracking-[0.14em] uppercase text-ink"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Aggiorna
          </button>
        </div>

        {/* Dati di tiratura, come il colophon di un manifesto. */}
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink/25 pt-4">
          <Stat label="Appuntamenti" value={loading ? '—' : String(events.length)} />
          <Stat label="Oggi" value={loading ? '—' : String(today.length)} />
          <Stat label="Prossimo" value={headline ? <DateRange event={headline} /> : '—'} />
          <Stat label="Fonte" value="Google Calendar" />
        </dl>
      </section>

      {/* ------------------------------------------------- oggi e domani -- */}
      {!loading && (
        /* Un foglio appeso al bar ci resta due settimane: "oggi" e "domani"
           sono le prime due cose che diventano false. */
        <section
          style={{ animationDelay: '60ms' }}
          className="no-print mb-8 grid animate-ink-rise gap-4 sm:grid-cols-2"
        >
          <DayPanel title="Oggi" events={today} extrasOf={extrasOf} onSelect={setSelected} accent />
          <DayPanel title="Domani" events={tomorrow} extrasOf={extrasOf} onSelect={setSelected} />
        </section>
      )}

      {/* ------------------------------------------------- festa in testa -- */}
      {headline && !loading && (
        <button
          onClick={() => setSelected(headline)}
          style={{ animationDelay: '90ms' }}
          /* Anche "in arrivo" invecchia, e la festa in testa è comunque la
             prima riga del cartellone qui sotto. */
          className="ink-box group no-print mb-8 flex w-full animate-ink-rise items-stretch overflow-hidden text-left transition-transform hover:translate-x-[1px] hover:translate-y-[1px]"
        >
          <span
            className="w-2 shrink-0"
            style={{
              backgroundColor: categorize(headline.title, headline.description, extrasOf(headline.id).category)
                .color,
            }}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="eyebrow">
                  {headlineFeatured ? 'Segnalata dall’organizzatore' : headlineOngoing ? 'In corso ora' : 'In arrivo'}
                </span>
                {headlineFeatured && <Star size={11} className="text-vermiglio" fill="currentColor" />}
                {headlineOngoing && <span className="h-1.5 w-1.5 rounded-full bg-vermiglio" aria-hidden />}
              </span>
              <span className="mt-1 block truncate font-display text-xl font-black text-ink sm:text-2xl">
                {headline.title}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                {headline.location && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{headline.location}</span>
                  </span>
                )}
                {isMultiDay(headline) && (
                  <span className="font-semibold whitespace-nowrap">{formatDuration(headline)} di festa</span>
                )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <DateRange
                event={headline}
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
        {!loading && (
          <div className="no-print mb-4">
            <FilterBar
              filters={filters}
              onChange={set}
              onClear={clear}
              places={places}
              filtering={filtering}
              shown={filtered.length}
              total={events.length}
            />
          </div>
        )}

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
        ) : filtered.length === 0 ? (
          <div className="ink-box p-3 sm:p-5">
            <NoResults filters={filters} onChange={set} onClear={clear} />
          </div>
        ) : view === 'grid' ? (
          <CalendarView events={filtered} extrasOf={extrasOf} onSelectEvent={setSelected} />
        ) : (
          <div className="ink-box p-3 sm:p-5">
            <div className="bunting -mx-3 -mt-3 mb-4 sm:-mx-5 sm:-mt-5" aria-hidden />
            {months.length > 1 && <MonthRail months={months} />}
            <AgendaList
              events={filtered}
              extrasOf={extrasOf}
              onSelectEvent={setSelected}
              /* Con un ordine diverso dal cronologico i mesi non fanno più da
                 capitolo: l'elenco resta uno solo, nell'ordine chiesto. */
              flat={sort !== 'prossimi'}
            />
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- legenda -- */}
      <section style={{ animationDelay: '240ms' }} className="mt-8 animate-ink-rise">
        <p className="eyebrow">Legenda dei colori</p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {CATEGORIES.map((c) => (
            <li key={c.key} className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              <span className="h-3 w-3 border border-ink" style={{ backgroundColor: c.color }} aria-hidden />
              {c.label}
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------ portare via -- */}
      {/* Il cartellone non finisce nel telefono di chi l'ha guardato: o si
          appende al muro, o si infila nell'agenda. Le due cose che il sito
          non sa fare da solo le fanno la stampante e un file .ics. */}
      {!loading && filtered.length > 0 && (
        <section style={{ animationDelay: '300ms' }} className="no-print mt-8 animate-ink-rise">
          <p className="eyebrow">Portalo via</p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <button
              onClick={() => window.print()}
              className="stamp-btn tap tap-grow flex items-center gap-2 bg-paper-hi px-3.5 py-2.5 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-ink"
            >
              <Printer size={14} />
              Stampa il cartellone
            </button>
            <button
              onClick={() =>
                downloadIcs(
                  filtered,
                  place ? `Sagre a ${place}` : 'Eventi e Sagre',
                  icsFileName(place ? `sagre-${place}` : 'cartellone-sagre')
                )
              }
              className="stamp-btn tap tap-grow flex items-center gap-2 bg-paper-hi px-3.5 py-2.5 text-[0.65rem] font-bold tracking-[0.12em] uppercase text-ink"
            >
              <CalendarArrowDown size={14} />
              Scarica in agenda
            </button>
          </div>
          <p className="mt-2 text-[0.65rem] text-ink-faint">
            Sul foglio finisce quel che stai guardando adesso, filtri compresi.
            {' '}Il file .ics lo aprono iPhone, Outlook e Google Calendar.
          </p>
        </section>
      )}

      <footer className="mt-12 border-t-2 border-ink pt-4">
        <p className="eyebrow">Stampato in proprio · Le locandine sono caricate dall'organizzatore</p>
      </footer>

      {!selected && <BackToTop />}

      {selected && (
        <EventModal
          event={selected}
          onClose={closeEvent}
          /* Sfogliare non lascia tappe nella cronologia: chiudere deve
             riportare al cartellone, non alla sagra di prima. */
          onPrev={
            navIndex > 0 ? () => openEvent(filtered[navIndex - 1].id, { replace: true }) : null
          }
          onNext={
            navIndex >= 0 && navIndex < filtered.length - 1
              ? () => openEvent(filtered[navIndex + 1].id, { replace: true })
              : null
          }
          position={navIndex >= 0 ? { index: navIndex, total: filtered.length } : null}
        />
      )}
    </main>
  )
}

/* ------------------------------------------------------- oggi e domani -- */

function DayPanel({
  title,
  events,
  extrasOf,
  onSelect,
  accent,
}: {
  title: string
  events: CalendarEvent[]
  extrasOf: (eventId: string) => EventExtras
  onSelect: (event: CalendarEvent) => void
  accent?: boolean
}) {
  const when = new Date()
  const label = title === 'Oggi' ? when : addDays(when, 1)

  return (
    /* `min-w-0`: senza, la cella della griglia non scende sotto la larghezza
       del titolo più lungo — che essendo su una riga sola non va a capo — e la
       pagina prende mezzo schermo di scorrimento laterale sul telefono. */
    <div className={`ink-box-sm min-w-0 p-3 ${accent ? 'border-vermiglio' : ''}`}>
      <div className="flex items-baseline justify-between gap-2 border-b-2 border-ink/20 pb-2">
        <h2 className="font-display text-lg leading-none font-black text-ink">{title}</h2>
        <span className="eyebrow">
          {label.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="flex items-center gap-2 py-4 text-xs text-ink-faint">
          <CalendarX size={14} />
          Niente in programma.
        </p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} extras={extrasOf(event.id)} onSelect={onSelect} hideDate />
            </li>
          ))}
        </ul>
      )}
    </div>
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
