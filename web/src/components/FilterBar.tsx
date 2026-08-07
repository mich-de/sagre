import { Search, X, LayoutGrid, Rows3 } from 'lucide-react'
import { CATEGORIES } from '../lib/categorize'

export type CalendarViewMode = 'grid' | 'list'
export type TimeRange = 'tutti' | 'settimana' | 'futuri'

interface FilterBarProps {
  query: string
  onQuery: (value: string) => void
  active: string[]
  onToggleCategory: (key: string) => void
  onClear: () => void
  view: CalendarViewMode
  onView: (view: CalendarViewMode) => void
  range: TimeRange
  onRange: (range: TimeRange) => void
  shown: number
  total: number
}

const RANGES: Array<{ key: TimeRange; label: string }> = [
  { key: 'futuri', label: 'In arrivo' },
  { key: 'settimana', label: 'Prossimi 7 giorni' },
  { key: 'tutti', label: 'Tutto lo storico' },
]

/** Barra dei filtri: ricerca, colori, finestra temporale, griglia o elenco.
 *  I filtri valgono per entrambe le viste, così passando dall'una all'altra
 *  non si perde quello che si stava cercando. */
export function FilterBar({
  query,
  onQuery,
  active,
  onToggleCategory,
  onClear,
  view,
  onView,
  range,
  onRange,
  shown,
  total,
}: FilterBarProps) {
  const filtering = active.length > 0 || query.trim().length > 0 || range !== 'futuri'

  return (
    <div className="ink-box-sm p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Cerca una festa o un paese…"
            className="w-full border-2 border-ink bg-paper py-1.5 pr-2 pl-8 text-sm text-ink outline-none placeholder:text-ink-faint focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio"
          />
        </div>

        <div className="flex shrink-0 items-center">
          <ViewButton active={view === 'grid'} onClick={() => onView('grid')} label="Griglia">
            <LayoutGrid size={13} />
          </ViewButton>
          <ViewButton active={view === 'list'} onClick={() => onView('list')} label="Elenco">
            <Rows3 size={13} />
          </ViewButton>
        </div>
      </div>

      {/* La finestra temporale ha senso solo nell'elenco: la griglia mostra
          comunque il mese che si sta guardando. */}
      {view === 'list' && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => onRange(r.key)}
              className={`border-2 px-2.5 py-1 text-[0.6rem] font-bold tracking-[0.12em] uppercase transition-colors ${
                range === r.key
                  ? 'border-ink bg-ink text-paper-hi'
                  : 'border-ink/25 bg-transparent text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {CATEGORIES.map((c) => {
          const on = active.includes(c.key)
          return (
            <button
              key={c.key}
              onClick={() => onToggleCategory(c.key)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 border-2 px-2 py-1 text-[0.6rem] font-bold tracking-[0.1em] uppercase transition-colors ${
                on ? 'border-ink text-paper-hi' : 'border-ink/25 text-ink-soft hover:border-ink hover:text-ink'
              }`}
              style={on ? { backgroundColor: c.color } : undefined}
            >
              <span
                className="h-2 w-2 border border-ink/50"
                style={{ backgroundColor: on ? 'transparent' : c.color }}
                aria-hidden
              />
              {c.label}
            </button>
          )
        })}

        {filtering && (
          <button
            onClick={onClear}
            className="ml-auto flex items-center gap-1 text-[0.6rem] font-bold tracking-[0.12em] uppercase text-vermiglio hover:underline"
          >
            <X size={11} />
            Azzera
          </button>
        )}
      </div>

      <p className="mt-2.5 text-[0.65rem] text-ink-faint">
        {shown === total ? `${total} appuntamenti in cartellone` : `${shown} di ${total} appuntamenti`}
      </p>
    </div>
  )
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 border-2 border-ink px-2.5 py-1.5 text-[0.6rem] font-bold tracking-[0.12em] uppercase transition-colors first:border-r-0 ${
        active ? 'bg-ink text-paper-hi' : 'bg-paper-hi text-ink hover:bg-paper-2'
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
