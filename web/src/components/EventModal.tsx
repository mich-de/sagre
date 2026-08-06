import { useEffect, useState } from 'react'
import { X, MapPin, CalendarPlus, ExternalLink } from 'lucide-react'
import type { CalendarEvent } from '../lib/googleCalendar'
import { googleCalendarAddUrl } from '../lib/googleCalendar'
import { getPoster } from '../lib/posters'
import { categorize } from '../lib/categorize'

interface EventModalProps {
  event: CalendarEvent
  onClose: () => void
}

function formatDateRange(event: CalendarEvent): string {
  const opts: Intl.DateTimeFormatOptions = event.allDay
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
  const start = new Date(event.start)
  const end = new Date(event.end)
  const startStr = start.toLocaleDateString('it-IT', opts)
  const sameDay = start.toDateString() === end.toDateString()
  if (event.allDay && sameDay) return capitalize(startStr)
  const endStr = end.toLocaleDateString('it-IT', opts)
  return `${capitalize(startStr)} → ${endStr}`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function EventModal({ event, onClose }: EventModalProps) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [posterLoading, setPosterLoading] = useState(true)
  const category = categorize(event.title, event.description)

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[var(--color-outline-dark)] bg-[var(--color-surface-dark)] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60"
          aria-label="Chiudi"
        >
          <X size={18} />
        </button>

        <div className="relative flex h-40 items-center justify-center overflow-hidden bg-[var(--color-surface2-dark)]">
          {posterLoading ? (
            <div className="h-full w-full animate-pulse bg-[var(--color-surface3-dark)]" />
          ) : posterUrl ? (
            <img src={posterUrl} alt={event.title} className="h-full w-full object-cover" />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-4xl"
              style={{ background: `linear-gradient(135deg, ${category.color}55, var(--color-surface2-dark))` }}
            >
              🎪
            </div>
          )}
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-xs font-semibold text-black/80"
            style={{ backgroundColor: category.color }}
          >
            {category.label}
          </span>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <h2 className="font-[var(--font-display)] text-xl font-semibold text-[var(--color-on-bg-dark)]">
              {event.title}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-on-surface-variant-dark)]">
              {formatDateRange(event)}
            </p>
          </div>

          {event.location && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-2 text-sm text-[var(--color-on-surface-dark)] hover:text-[var(--color-orange-warm)]"
            >
              <MapPin size={16} className="mt-0.5 shrink-0" />
              <span>{event.location}</span>
            </a>
          )}

          {event.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-on-surface-dark)]">
              {event.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href={googleCalendarAddUrl(event)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-[var(--color-orange-hot)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <CalendarPlus size={16} />
              Aggiungi al calendario
            </a>
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-outline-dark)] px-4 py-2 text-sm text-[var(--color-on-surface-dark)] transition-colors hover:border-[var(--color-orange-warm)]"
            >
              <ExternalLink size={16} />
              Apri su Google Calendar
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
