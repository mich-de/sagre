import { useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import type { CalendarEvent } from '../lib/googleCalendar'
import { googleCalendarAddUrl } from '../lib/googleCalendar'
import { getEventMedia, type EventMedia } from '../lib/posters'
import { linkKind, type EventLink, type LinkKind } from '../lib/links'
import { categorize } from '../lib/categorize'
import { formatDateRange, formatDuration, eventStart, eventEndInclusive, isMultiDay, isOngoing } from '../lib/dates'

interface EventModalProps {
  event: CalendarEvent
  onClose: () => void
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

export function EventModal({ event, onClose }: EventModalProps) {
  const [media, setMedia] = useState<EventMedia | null>(null)
  const [mediaLoading, setMediaLoading] = useState(true)
  const [zoomed, setZoomed] = useState(false)
  const [index, setIndex] = useState(0)
  const category = categorize(event.title, event.description)
  const start = eventStart(event)
  const end = eventEndInclusive(event)
  const multiDay = isMultiDay(event)
  const ongoing = isOngoing(event)

  const images = useMemo(() => {
    if (!media) return [] as string[]
    return [media.cover, ...media.photos.map((p) => p.dataUrl)].filter((x): x is string => Boolean(x))
  }, [media])

  const links: EventLink[] = media?.links ?? []
  const current = images[index] ?? null

  useEffect(() => {
    let cancelled = false
    setMediaLoading(true)
    getEventMedia(event.id)
      .then((m) => {
        if (!cancelled) setMedia(m)
      })
      .catch(() => {
        if (!cancelled) setMedia({ cover: null, photos: [], links: [] })
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [event.id])

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

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
      >
        <div
          className="ink-box relative max-h-[92vh] w-full max-w-lg animate-stamp-in overflow-y-auto rounded-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 border-2 border-ink bg-paper-hi p-1.5 text-ink shadow-[2px_2px_0_var(--color-ink)] transition-transform hover:translate-x-[1px] hover:translate-y-[1px]"
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
                onClick={() => setZoomed(true)}
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
          <div className="space-y-4 p-5 sm:p-6">
            <div>
              <h2 className="font-display text-2xl leading-tight font-black text-ink sm:text-3xl">
                {event.title}
              </h2>
              <p className="mt-2 text-sm font-medium text-ink-soft">{formatDateRange(event)}</p>

              {(multiDay || ongoing) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
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
                className="flex items-start gap-2 text-sm font-medium text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:text-vermiglio hover:decoration-vermiglio"
              >
                <MapPin size={15} className="mt-0.5 shrink-0" />
                <span>{event.location}</span>
              </a>
            )}

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

            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href={googleCalendarAddUrl(event)}
                target="_blank"
                rel="noreferrer"
                className="stamp-btn flex items-center gap-2 bg-vermiglio px-4 py-2 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi"
              >
                <CalendarPlus size={15} />
                Segna in agenda
              </a>
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noreferrer"
                className="stamp-btn flex items-center gap-2 bg-paper-hi px-4 py-2 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-ink"
              >
                <ExternalLink size={15} />
                Su Google
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------- lightbox -- */}
      {zoomed && current && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/95 p-4 sm:p-10"
          onClick={() => setZoomed(false)}
        >
          <button
            onClick={() => setZoomed(false)}
            className="absolute right-4 top-4 border-2 border-paper-hi bg-transparent p-2 text-paper-hi transition-colors hover:bg-paper-hi hover:text-ink"
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
                className="absolute left-2 top-1/2 -translate-y-1/2 border-2 border-paper-hi p-2 text-paper-hi transition-colors hover:bg-paper-hi hover:text-ink sm:left-6"
                aria-label="Foto precedente"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  step(1)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 border-2 border-paper-hi p-2 text-paper-hi transition-colors hover:bg-paper-hi hover:text-ink sm:right-6"
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
              className="max-h-[78vh] max-w-full cursor-zoom-out border-2 border-paper-hi object-contain shadow-[8px_8px_0_rgba(251,246,234,0.25)]"
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
