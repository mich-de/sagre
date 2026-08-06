import { useState } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { useCalendarEvents } from '../hooks/useCalendarEvents'
import { CalendarView } from '../components/CalendarView'
import { EventModal } from '../components/EventModal'
import type { CalendarEvent } from '../lib/googleCalendar'

export function Home() {
  const { events, loading, error, reload } = useCalendarEvents()
  const [selected, setSelected] = useState<CalendarEvent | null>(null)

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-bold text-[var(--color-on-bg-dark)] sm:text-3xl">
            Prossimi eventi
          </h1>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant-dark)]">
            Sagre, feste e appuntamenti in zona — aggiornati automaticamente da Google Calendar.
          </p>
        </div>
        <button
          onClick={reload}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-outline-dark)] px-3 py-1.5 text-xs text-[var(--color-on-surface-variant-dark)] transition-colors hover:border-[var(--color-orange-warm)] hover:text-[var(--color-on-bg-dark)]"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Aggiorna
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--color-surface-dark)]" />
          ))}
        </div>
      ) : (
        <CalendarView events={events} onSelectEvent={setSelected} />
      )}

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}
