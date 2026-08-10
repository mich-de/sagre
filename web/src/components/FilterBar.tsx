import { useEffect, useRef } from 'react'
import { Search, X, LayoutGrid, Rows3, MapPin, ArrowDownWideNarrow } from 'lucide-react'
import { CATEGORIES } from '../lib/categorize'
import { RANGES, SORTS, type CalendarViewMode, type SortKey, type TimeRange } from '../lib/filters'
import type { HomeFilters } from '../hooks/useHomeFilters'

interface FilterBarProps {
  filters: HomeFilters
  onChange: (patch: Partial<HomeFilters>, options?: { replace?: boolean }) => void
  onClear: () => void
  /** I paesi ricavati dagli eventi, non un elenco scritto a mano. */
  places: string[]
  filtering: boolean
  shown: number
  total: number
}

/** Barra dei filtri: ricerca, paese, finestra temporale, ordine, colori,
 *  griglia o elenco. I filtri valgono per entrambe le viste, così passando
 *  dall'una all'altra non si perde quello che si stava cercando. */
export function FilterBar({ filters, onChange, onClear, places, filtering, shown, total }: FilterBarProps) {
  const { query, categories, range, from, to, place, sort, view } = filters
  const list = view === 'list'
  const searchRef = useRef<HTMLInputElement | null>(null)

  /* "/" porta il cursore nella ricerca, come su ogni sito che si sfoglia
     davvero. Non mentre si sta già scrivendo da qualche parte, ovviamente. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="ink-box-sm p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            /* `replace`: un filtro che cambia a ogni tasto premuto non deve
               riempire la cronologia del browser. */
            onChange={(e) => onChange({ query: e.target.value }, { replace: true })}
            placeholder="Cerca una festa o un paese…"
            /* 16px pieni: sotto quella misura Safari su iPhone ingrandisce la
               pagina appena si tocca il campo e non la rimpicciolisce più. */
            className="w-full border-2 border-ink bg-paper py-2 pr-2 pl-8 text-base text-ink outline-none placeholder:text-ink-faint focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:py-1.5 sm:text-sm"
          />
          {/* La scorciatoia si vede solo dove c'è una tastiera. */}
          {!query && (
            <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 border border-ink/30 bg-paper-2 px-1.5 py-px text-[0.62rem] font-bold text-ink-faint sm:block">
              /
            </kbd>
          )}
        </div>

        <div className="flex shrink-0 items-center">
          <ViewButton active={view === 'grid'} onClick={() => onChange({ view: 'grid' })} label="Griglia">
            <LayoutGrid size={13} />
          </ViewButton>
          <ViewButton active={list} onClick={() => onChange({ view: 'list' })} label="Elenco">
            <Rows3 size={13} />
          </ViewButton>
        </div>
      </div>

      {/* ------------------------------------------------- paese e ordine -- */}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {places.length > 1 && (
          <label className="relative min-w-0 flex-1 basis-44">
            <MapPin size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint" />
            <span className="sr-only">Paese</span>
            <select
              value={place}
              onChange={(e) => onChange({ place: e.target.value })}
              className="w-full appearance-none border-2 border-ink bg-paper-hi py-2 pr-2 pl-8 text-base font-semibold text-ink outline-none focus:ring-2 focus:ring-vermiglio sm:py-1.5 sm:text-xs"
            >
              <option value="">Tutti i paesi</option>
              {places.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* L'ordine ha senso solo nell'elenco: la griglia è il calendario, e un
            calendario in ordine alfabetico non è più un calendario. */}
        {list && (
          <label className="relative min-w-0 flex-1 basis-44">
            <ArrowDownWideNarrow size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint" />
            <span className="sr-only">Ordine</span>
            <select
              value={sort}
              onChange={(e) => onChange({ sort: e.target.value as SortKey })}
              className="w-full appearance-none border-2 border-ink bg-paper-hi py-2 pr-2 pl-8 text-base font-semibold text-ink outline-none focus:ring-2 focus:ring-vermiglio sm:py-1.5 sm:text-xs"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* La finestra temporale ha senso solo nell'elenco: la griglia mostra
          comunque il mese che si sta guardando. */}
      {list && (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => onChange({ range: r.key })}
                className={`tap-grow flex items-center border-2 px-3 py-1.5 text-[0.6rem] font-bold tracking-[0.12em] uppercase transition-colors ${
                  range === r.key
                    ? 'border-ink bg-ink text-paper-hi'
                    : 'border-ink/25 bg-transparent text-ink-soft hover:border-ink hover:text-ink'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {range === 'intervallo' && (
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <DateField label="Dal giorno" value={from} onChange={(v) => onChange({ from: v })} />
              <DateField label="Al giorno" value={to} onChange={(v) => onChange({ to: v })} min={from} />
              {(from || to) && (
                <button
                  onClick={() => onChange({ from: '', to: '' })}
                  className="tap tap-grow flex items-center gap-1 px-2 py-1.5 text-[0.6rem] font-bold tracking-[0.12em] uppercase text-vermiglio hover:underline"
                >
                  <X size={11} />
                  Date
                </button>
              )}
            </div>
          )}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {CATEGORIES.map((c) => {
          const on = categories.includes(c.key)
          return (
            <button
              key={c.key}
              onClick={() =>
                onChange({
                  categories: on ? categories.filter((k) => k !== c.key) : [...categories, c.key],
                })
              }
              aria-pressed={on}
              className={`tap-grow flex items-center gap-1.5 border-2 px-2.5 py-1.5 text-[0.6rem] font-bold tracking-[0.1em] uppercase transition-colors ${
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
            className="tap tap-grow ml-auto flex items-center gap-1 px-2 py-1.5 text-[0.6rem] font-bold tracking-[0.12em] uppercase text-vermiglio hover:underline"
          >
            <X size={11} />
            Azzera
          </button>
        )}
      </div>

      <p className="mt-2.5 text-[0.65rem] text-ink-faint">
        {shown === total ? `${total} appuntamenti in cartellone` : `${shown} di ${total} appuntamenti`}
        {place && ` · ${place}`}
      </p>
    </div>
  )
}

function DateField({
  label,
  value,
  onChange,
  min,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
}) {
  return (
    <label className="min-w-0 flex-1 basis-36">
      <span className="eyebrow mb-1 block">{label}</span>
      <input
        type="date"
        value={value}
        min={min || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border-2 border-ink bg-paper-hi px-2.5 py-2 text-base text-ink outline-none focus:ring-2 focus:ring-vermiglio sm:py-1.5 sm:text-xs"
      />
    </label>
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
      title={label}
      className={`tap tap-grow flex items-center gap-1.5 border-2 border-ink px-3 py-2 text-[0.6rem] font-bold tracking-[0.12em] uppercase transition-colors first:border-r-0 ${
        active ? 'bg-ink text-paper-hi' : 'bg-paper-hi text-ink hover:bg-paper-2'
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

export type { CalendarViewMode, TimeRange }
