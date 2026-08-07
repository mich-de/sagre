import { useEffect, useState } from 'react'
import { X, MapPin, CalendarPlus, ExternalLink, Expand, Scissors, CalendarRange } from 'lucide-react'
import type { CalendarEvent } from '../lib/googleCalendar'
import { googleCalendarAddUrl } from '../lib/googleCalendar'
import { getPoster } from '../lib/posters'
import { categorize } from '../lib/categorize'
import { formatDateRange, formatDuration, eventStart, eventEndInclusive, isMultiDay, isOngoing } from '../lib/dates'

interface EventModalProps {
  event: CalendarEvent
  onClose: () => void
}

export function EventModal({ event, onClose }: EventModalProps) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [posterLoading, setPosterLoading] = useState(true)
  const [zoomed, setZoomed] = useState(false)
  const category = categorize(event.title, event.description)
  const start = eventStart(event)
  const end = eventEndInclusive(event)
  const multiDay = isMultiDay(event)
  const ongoing = isOngoing(event)

  useEffect(() => {
    let cancelled = false
    setPosterLoading(true)
    getPoster(event.id)
      .then((poster) => {
        if (!cancelled) setPosterUrl(poster?.dataUrl ?? null)
      })
      .catch(() => {
        if (!cancelled) setPosterUrl(null)
      })
      .finally(() => {
        if (!cancelled) setPosterLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [event.id])

  // Esc chiude prima l'ingrandimento, poi la scheda. Blocca lo scorrimento sotto.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (zoomed) setZoomed(false)
      else onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [zoomed, onClose])

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

          {/* ------------------------------------------------- locandina -- */}
          <div className="relative flex h-52 items-center justify-center overflow-hidden border-b-2 border-ink bg-paper-2 sm:h-60">
            {posterLoading ? (
              <div className="h-full w-full animate-pulse bg-paper-3" />
            ) : posterUrl ? (
              <button
                type="button"
                onClick={() => setZoomed(true)}
                className="group h-full w-full cursor-zoom-in"
                aria-label="Ingrandisci la locandina"
              >
                <img src={posterUrl} alt={`Locandina di ${event.title}`} className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-end justify-end p-3 transition-colors group-hover:bg-ink/20">
                  <span className="flex items-center gap-1.5 border-2 border-ink bg-paper-hi px-2.5 py-1 text-[0.6rem] font-bold tracking-[0.12em] uppercase text-ink shadow-[2px_2px_0_var(--color-ink)]">
                    <Expand size={12} />
                    Ingrandisci
                  </span>
                </span>
              </button>
            ) : (
              /* Senza locandina: data cubitale, come un manifesto solo testo. */
              <div className="halftone absolute inset-0" aria-hidden />
            )}

            {!posterUrl && !posterLoading && (
              <div className="relative text-center">
                <div className="flex items-baseline justify-center gap-2 font-display text-6xl leading-none font-black text-ink sm:text-7xl">
                  {start.getDate()}
                  {multiDay && (
                    <>
                      <span className="text-3xl font-normal text-vermiglio sm:text-4xl">–</span>
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
      {zoomed && posterUrl && (
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
          <figure className="flex max-h-full max-w-full flex-col items-center gap-3">
            <img
              src={posterUrl}
              alt={`Locandina di ${event.title}`}
              className="max-h-[80vh] max-w-full cursor-zoom-out border-2 border-paper-hi object-contain shadow-[8px_8px_0_rgba(251,246,234,0.25)]"
            />
            <figcaption className="text-center text-[0.65rem] font-bold tracking-[0.2em] uppercase text-paper-hi/70">
              {event.title}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  )
}
