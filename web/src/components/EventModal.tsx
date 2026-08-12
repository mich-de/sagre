import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X,
  MapPin,
  CalendarPlus,
  ExternalLink,
  Expand,
  Scissors,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Camera,
  Users,
  PlayCircle,
  Music2,
  Newspaper,
  Globe,
  Ban,
  Megaphone,
  Share2,
  Check,
  ArrowLeft,
  ArrowRight,
  CalendarArrowDown,
} from 'lucide-react'
import type { CalendarEvent } from '../lib/googleCalendar'
import { googleCalendarAddUrl } from '../lib/googleCalendar'
import { getEventMedia, EMPTY_EXTRAS, type EventMedia } from '../lib/posters'
import { linkKind, type EventLink, type LinkKind } from '../lib/links'
import { categorize } from '../lib/categorize'
import { downloadIcs, icsFileName } from '../lib/ics'
import { WeatherStrip } from './WeatherStrip'
import { formatDateRange, formatDuration, eventStart, eventEndInclusive, isMultiDay, isOngoing } from '../lib/dates'

interface EventModalProps {
  event: CalendarEvent
  onClose: () => void
  /** Sfogliare il cartellone senza chiudere e riaprire: `null` quando la
   *  scheda non fa parte di un elenco (o è la prima / l'ultima). */
  onPrev?: (() => void) | null
  onNext?: (() => void) | null
  /** "3 di 27": dice quanto manca alla fine. */
  position?: { index: number; total: number } | null
}

/* lucide non spedisce più i marchi: si usano icone generiche coerenti. */
const LINK_ICON: Record<LinkKind, typeof Globe> = {
  instagram: Camera,
  facebook: Users,
  youtube: PlayCircle,
  tiktok: Music2,
  article: Newspaper,
  web: Globe,
}

const SWIPE_MIN = 55

export function EventModal({ event, onClose, onPrev, onNext, position }: EventModalProps) {
  const [media, setMedia] = useState<EventMedia | null>(null)
  const [mediaLoading, setMediaLoading] = useState(true)
  const [zoomed, setZoomed] = useState(false)
  const [index, setIndex] = useState(0)
  const [shared, setShared] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const touch = useRef<{ x: number; y: number; top: number } | null>(null)
  const swiped = useRef(false)
  const category = categorize(event.title, event.description, media?.category)
  const start = eventStart(event)
  const end = eventEndInclusive(event)
  const multiDay = isMultiDay(event)
  const status = media?.status ?? 'confermato'
  const cancelled = status === 'annullato'
  const ongoing = isOngoing(event) && !cancelled

  /* La copertina è la prima foto della galleria; `cover` da solo resta il caso
     del vecchio schema, prima che l'organizzatore riapra l'evento. */
  const images = useMemo(() => {
    if (!media) return [] as string[]
    if (media.photos.length > 0) return media.photos.map((p) => p.dataUrl)
    return media.cover ? [media.cover] : []
  }, [media])

  const links: EventLink[] = media?.links ?? []
  const current = images[index] ?? null

  useEffect(() => {
    let aborted = false
    /* Passando alla sagra dopo, la pellicola riparte dalla prima foto: la
       terza dell'evento di prima qui potrebbe non esistere nemmeno. */
    setIndex(0)
    setZoomed(false)
    setShared(false)
    setMediaLoading(true)
    getEventMedia(event.id)
      .then((m) => {
        if (!aborted) setMedia(m)
      })
      .catch(() => {
        if (!aborted) setMedia({ ...EMPTY_EXTRAS, eventId: event.id, cover: null, photos: [] })
      })
      .finally(() => {
        if (!aborted) setMediaLoading(false)
      })
    return () => {
      aborted = true
    }
  }, [event.id])

  /* Il fuoco entra nella scheda quando si apre e torna da dove veniva quando
     si chiude: senza, chi naviga da tastiera resta a tabulare la pagina
     coperta dietro il velo. */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => previous?.focus?.()
  }, [])

  // Esc chiude prima l'ingrandimento, poi la scheda. Le frecce scorrono le foto.
  useEffect(() => {
    function step(delta: number) {
      if (images.length < 2) return
      setIndex((i) => (i + delta + images.length) % images.length)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (zoomed) setZoomed(false)
        else onClose()
        return
      }
      /* Tabulazione chiusa dentro la scheda, com'è d'obbligo per una
         finestra modale. */
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === panelRef.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
        return
      }
      if (!zoomed) return
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [zoomed, onClose, images.length])

  function step(delta: number) {
    if (images.length < 2) return
    setIndex((i) => (i + delta + images.length) % images.length)
  }

  /* Un dito solo per tutto: di lato scorre le locandine, verso il basso —
     e solo se la scheda è già in cima — la richiude come un cassetto. */
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY, top: panelRef.current?.scrollTop ?? 0 }
  }

  function onTouchEnd(e: React.TouchEvent) {
    const from = touch.current
    if (!from) return
    touch.current = null
    const t = e.changedTouches[0]
    const dx = t.clientX - from.x
    const dy = t.clientY - from.y
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) {
      /* Il tocco finisce comunque in un `click`: senza questa bandierina,
         scorrere le foto aprirebbe anche l'ingrandimento. */
      swiped.current = true
      step(dx < 0 ? 1 : -1)
      return
    }
    if (dy > 90 && from.top <= 0 && Math.abs(dy) > Math.abs(dx) * 1.5) onClose()
  }

  /* L'indirizzo porta già l'evento aperto (`?e=`), quindi si condivide quello
     che si ha sotto gli occhi. Sul telefono si apre il foglio di sistema —
     WhatsApp, dove finiscono davvero le sagre; altrove si copia e basta. */
  async function share() {
    const url = window.location.href
    const data = { title: event.title, text: `${event.title} — ${formatDateRange(event)}`, url }
    try {
      if (navigator.share) {
        await navigator.share(data)
        return
      }
      await navigator.clipboard.writeText(url)
      setShared(true)
      window.setTimeout(() => setShared(false), 2200)
    } catch {
      /* Foglio chiuso a mano o appunti negati: non c'è niente da dire. */
    }
  }

  function openZoom() {
    if (swiped.current) {
      swiped.current = false
      return
    }
    setZoomed(true)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={event.title}
          /* `dvh` e non `vh`: con la barra degli indirizzi che va e viene,
             `vh` misura uno schermo che non c'è e il fondo resta tagliato.
             `overscroll-contain` tiene lo scorrimento dentro la scheda invece
             di trascinarsi dietro la pagina. */
          className="ink-box relative max-h-[92dvh] w-full max-w-lg animate-sheet-up overflow-y-auto overscroll-contain rounded-none outline-none sm:max-h-[92vh] sm:animate-stamp-in"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Maniglia del cassetto: dice che il foglio si tira giù. */}
          <span
            className="pointer-events-none absolute left-1/2 top-2 z-20 h-1 w-10 -translate-x-1/2 rounded-full bg-paper-hi/85 shadow-[0_0_0_1px_rgba(23,19,16,0.4)] sm:hidden"
            aria-hidden
          />

          <button
            onClick={onClose}
            className="tap absolute right-3 top-3 z-10 border-2 border-ink bg-paper-hi p-2.5 text-ink shadow-[2px_2px_0_var(--color-ink)] transition-transform hover:translate-x-[1px] hover:translate-y-[1px] sm:p-1.5"
            aria-label="Chiudi"
          >
            <X size={16} />
          </button>

          {/* ------------------------------------------------- locandine -- */}
          <div className="relative flex h-52 items-center justify-center overflow-hidden border-b-2 border-ink bg-paper-2 sm:h-60">
            {mediaLoading ? (
              <div className="h-full w-full animate-pulse bg-paper-3" />
            ) : current ? (
              <button
                type="button"
                onClick={openZoom}
                className="group relative h-full w-full cursor-zoom-in"
                aria-label="Ingrandisci la locandina"
              >
                {/* La locandina va vista intera: sfocata a riempire lo sfondo,
                    nitida e completa in primo piano. */}
                <img
                  src={current}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl brightness-90"
                />
                <img
                  src={current}
                  alt={`Locandina di ${event.title}`}
                  className="relative h-full w-full object-contain"
                />
                <span className="absolute inset-0 flex items-end justify-end p-3 transition-colors group-hover:bg-ink/20">
                  <span className="flex items-center gap-1.5 border-2 border-ink bg-paper-hi px-2.5 py-1 text-[0.6rem] font-bold tracking-[0.12em] uppercase text-ink shadow-[2px_2px_0_var(--color-ink)]">
                    <Expand size={12} />
                    {images.length > 1 ? `${index + 1} di ${images.length}` : 'Ingrandisci'}
                  </span>
                </span>
              </button>
            ) : (
              /* Senza locandina: data cubitale, come un manifesto solo testo. */
              <div className="halftone absolute inset-0" aria-hidden />
            )}

            {!current && !mediaLoading && (
              <div className="relative text-center">
                <div className="flex items-baseline justify-center gap-2 font-display text-6xl leading-none font-black text-ink sm:text-7xl">
                  {start.getDate()}
                  {multiDay && (
                    <>
                      <span className="font-body text-3xl font-bold text-vermiglio sm:text-4xl">–</span>
                      {end.getDate()}
                    </>
                  )}
                </div>
                <div className="mt-2 text-[0.65rem] font-bold tracking-[0.3em] uppercase text-ink-soft">
                  {start.getMonth() === end.getMonth()
                    ? start.toLocaleDateString('it-IT', { month: 'long' })
                    : `${start.toLocaleDateString('it-IT', { month: 'short' })} – ${end.toLocaleDateString('it-IT', { month: 'short' })}`}
                </div>
              </div>
            )}

            {/* Timbro di categoria, applicato storto. */}
            <span
              className="absolute left-3 top-3 -rotate-[4deg] border-2 border-ink px-2.5 py-0.5 text-[0.6rem] font-bold tracking-[0.16em] uppercase text-paper-hi shadow-[2px_2px_0_var(--color-ink)]"
              style={{ backgroundColor: category.color }}
            >
              {category.label}
            </span>
          </div>

          {/* Provini in fila, come una striscia di pellicola. */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-b-2 border-ink bg-paper-2 p-2">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Foto ${i + 1}`}
                  aria-current={i === index}
                  className={`h-12 w-12 shrink-0 overflow-hidden border-2 transition-transform ${
                    i === index
                      ? 'border-vermiglio shadow-[2px_2px_0_var(--color-ink)]'
                      : 'border-ink/40 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* --------------------------------------------------- biglietto -- */}
          <div className="space-y-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 sm:pb-6">
            <div>
              <h2
                className={`font-display text-2xl leading-tight font-black text-ink sm:text-3xl ${
                  cancelled ? 'line-through decoration-vermiglio decoration-2' : ''
                }`}
              >
                {event.title}
              </h2>
              <p className="mt-2 text-sm font-medium text-ink-soft">{formatDateRange(event)}</p>

              {(multiDay || ongoing || status !== 'confermato') && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {status !== 'confermato' && (
                    <span
                      className={`flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 text-[0.6rem] font-bold tracking-[0.14em] uppercase ${
                        cancelled ? 'bg-ink text-paper-hi' : 'bg-paper-3 text-ink'
                      }`}
                    >
                      <Ban size={11} />
                      {cancelled ? 'Annullato' : 'Rinviato'}
                    </span>
                  )}
                  {ongoing && (
                    <span className="flex items-center gap-1.5 border-2 border-ink bg-vermiglio px-2 py-0.5 text-[0.6rem] font-bold tracking-[0.14em] uppercase text-paper-hi">
                      <span className="h-1.5 w-1.5 rounded-full bg-paper-hi" aria-hidden />
                      In corso
                    </span>
                  )}
                  {multiDay && (
                    <span className="flex items-center gap-1.5 border-2 border-ink bg-paper-2 px-2 py-0.5 text-[0.6rem] font-bold tracking-[0.14em] uppercase text-ink">
                      <CalendarRange size={11} />
                      {formatDuration(event)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {event.location && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
                target="_blank"
                rel="noreferrer"
                className="tap flex items-start gap-2 py-1.5 text-sm font-medium text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:text-vermiglio hover:decoration-vermiglio"
              >
                <MapPin size={15} className="mt-0.5 shrink-0" />
                <span>{event.location}</span>
              </a>
            )}

            {/* Il tempo sta sotto il luogo perché è lì che si decide se
                andarci: una sagra in piazza con l'acqua è un'altra cosa. Sulle
                feste annullate non serve — non ci va più nessuno comunque. */}
            {!cancelled && <WeatherStrip event={event} />}

            {/* Linea di strappo del biglietto. */}
            <div className="flex items-center gap-2 py-1 text-ink-faint">
              <Scissors size={13} className="shrink-0 -scale-x-100" />
              <span className="h-px flex-1 border-t-2 border-dashed border-ink/30" />
            </div>

            {event.description && (
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-soft">
                {event.description}
              </p>
            )}

            {/* Nota dell'organizzatore: quel che Google Calendar non sa dire —
                menù, prezzi, dove si parcheggia, che si fa se piove. */}
            {media?.note && (
              <div className="border-l-4 border-vermiglio bg-paper-2 py-2.5 pr-3 pl-3">
                <p className="eyebrow flex items-center gap-1.5">
                  <Megaphone size={11} />
                  Dall'organizzatore
                </p>
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-ink">{media.note}</p>
              </div>
            )}

            {links.length > 0 && (
              <div>
                <p className="eyebrow">Dove se ne parla</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {links.map((link) => {
                    const Icon = LINK_ICON[linkKind(link.url)]
                    return (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 border-2 border-ink bg-paper-2 px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.08em] uppercase text-ink transition-colors hover:bg-ink hover:text-paper-hi"
                      >
                        <Icon size={13} />
                        {link.label}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sul telefono le azioni prendono tutta la riga: bersagli pieni
                invece di pastiglie da centrare col pollice. Le due minori si
                dividono una riga sola, così la scheda non diventa una scala. */}
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
              <a
                href={googleCalendarAddUrl(event)}
                target="_blank"
                rel="noreferrer"
                className="stamp-btn flex items-center justify-center gap-2 bg-vermiglio px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi sm:justify-start sm:py-2"
              >
                <CalendarPlus size={15} />
                Segna in agenda
              </a>
              {/* `sm:contents`: sul telefono sono due mezze colonne, sul
                  monitor tornano in fila con le altre come se non ci fosse. */}
              <div className="grid grid-cols-2 gap-3 sm:contents">
                {/* Chi ha l'iPhone o Outlook sul pulsante di Google non ci
                    clicca: il file lo aprono tutti, senza account. */}
                <button
                  type="button"
                  onClick={() => downloadIcs([event], event.title, icsFileName(event.title))}
                  className="stamp-btn flex items-center justify-center gap-2 bg-paper-hi px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-ink sm:justify-start sm:py-2"
                >
                  <CalendarArrowDown size={15} />
                  Scarica .ics
                </button>
                <button
                  type="button"
                  onClick={share}
                  className="stamp-btn flex items-center justify-center gap-2 bg-paper-hi px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-ink sm:justify-start sm:py-2"
                >
                  {shared ? <Check size={15} className="text-oliva" /> : <Share2 size={15} />}
                  {shared ? 'Copiato' : 'Condividi'}
                </button>
              </div>
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="stamp-btn flex items-center justify-center gap-2 bg-paper-hi px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-ink sm:justify-start sm:py-2"
              >
                <ExternalLink size={15} />
                Su Google
              </a>
            </div>

            {/* Sfogliare il cartellone senza uscire dalla scheda. Non sulle
                frecce della tastiera: lì ci scorrono già le locandine. */}
            {position && position.total > 1 && (
              <div className="mt-1 flex items-stretch border-2 border-ink bg-paper-2">
                <button
                  type="button"
                  onClick={() => onPrev?.()}
                  disabled={!onPrev}
                  className="flex flex-1 items-center justify-center gap-2 py-3.5 text-[0.62rem] font-bold tracking-[0.12em] uppercase text-ink transition-colors hover:bg-paper-3 disabled:text-ink-faint disabled:hover:bg-transparent"
                >
                  <ArrowLeft size={14} />
                  Prima
                </button>
                <span className="flex shrink-0 items-center border-x-2 border-ink px-3 text-[0.62rem] font-bold tracking-[0.12em] uppercase text-ink-soft">
                  {position.index + 1} di {position.total}
                </span>
                <button
                  type="button"
                  onClick={() => onNext?.()}
                  disabled={!onNext}
                  className="flex flex-1 items-center justify-center gap-2 py-3.5 text-[0.62rem] font-bold tracking-[0.12em] uppercase text-ink transition-colors hover:bg-paper-3 disabled:text-ink-faint disabled:hover:bg-transparent"
                >
                  Dopo
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- lightbox -- */}
      {zoomed && current && (
        <div
          className="safe-b fixed inset-0 z-[60] flex touch-none items-center justify-center overscroll-contain bg-ink/95 p-4 sm:p-10"
          onClick={() => setZoomed(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            onClick={() => setZoomed(false)}
            className="tap absolute right-4 top-4 border-2 border-paper-hi bg-transparent p-2.5 text-paper-hi transition-colors hover:bg-paper-hi hover:text-ink"
            aria-label="Chiudi ingrandimento"
          >
            <X size={20} />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  step(-1)
                }}
                className="tap absolute left-2 top-1/2 -translate-y-1/2 border-2 border-paper-hi p-2.5 text-paper-hi transition-colors hover:bg-paper-hi hover:text-ink sm:left-6"
                aria-label="Foto precedente"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  step(1)
                }}
                className="tap absolute right-2 top-1/2 -translate-y-1/2 border-2 border-paper-hi p-2.5 text-paper-hi transition-colors hover:bg-paper-hi hover:text-ink sm:right-6"
                aria-label="Foto successiva"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <figure className="flex max-h-full max-w-full flex-col items-center gap-3">
            <img
              src={current}
              alt={`Locandina di ${event.title}`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[72dvh] max-w-full cursor-zoom-out border-2 border-paper-hi object-contain shadow-[8px_8px_0_rgba(251,246,234,0.25)] sm:max-h-[78vh]"
            />
            <figcaption className="text-center text-[0.65rem] font-bold tracking-[0.2em] uppercase text-paper-hi/70">
              {event.title}
              {images.length > 1 && ` · ${index + 1} di ${images.length}`}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  )
}
