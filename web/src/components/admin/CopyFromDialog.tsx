import { useMemo, useState } from 'react'
import { AlertTriangle, Copy, Image as ImageIcon, Search, X } from 'lucide-react'
import type { CalendarEvent } from '../../lib/googleCalendar'
import type { CopyParts, EventExtras } from '../../lib/posters'
import { eventStart, shortRange, startOfDay } from '../../lib/dates'
import { PartToggle } from './PartToggle'

interface CopyFromDialogProps {
  events: CalendarEvent[]
  extrasOf: (eventId: string) => EventExtras
  target: CalendarEvent
  targetHasPhotos: boolean
  onClose: () => void
  /** `shiftDays` allinea il primo giorno del programma copiato al primo giorno
   *  di questa festa: le date delle righe sono vere, e quelle dell'edizione
   *  passata su questa non vorrebbero dire niente. */
  onCopy: (sourceId: string, parts: CopyParts, shiftDays: number) => Promise<void>
}

const DAY_MS = 86_400_000

/** Ricopia la scheda di un altro evento. Le sagre tornano ogni anno con la
 *  stessa locandina e gli stessi social: qui si pesca dall'edizione passata
 *  invece di rifare tutto a mano. */
export function CopyFromDialog({
  events,
  extrasOf,
  target,
  targetHasPhotos,
  onClose,
  onCopy,
}: CopyFromDialogProps) {
  const [query, setQuery] = useState('')
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [parts, setParts] = useState<CopyParts>({
    photos: true,
    links: true,
    note: true,
    programma: true,
    category: false,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* Ha senso pescare solo da chi ha qualcosa: gli eventi con la scheda vuota
     nell'elenco sono solo rumore. */
  const sources = useMemo(() => {
    const q = query.trim().toLowerCase()
    return events
      .filter((e) => {
        if (e.id === target.id) return false
        const ex = extrasOf(e.id)
        const rich =
          Boolean(ex.thumb) ||
          ex.hasLegacyCover ||
          ex.links.length > 0 ||
          Boolean(ex.note) ||
          ex.programma.length > 0 ||
          Boolean(ex.category)
        if (!rich) return false
        return !q || `${e.title} ${e.location}`.toLowerCase().includes(q)
      })
      .slice(0, 60)
  }, [events, extrasOf, target.id, query])

  const nothingChosen = !Object.values(parts).some(Boolean)
  const willReplace = parts.photos && targetHasPhotos

  async function handleCopy() {
    if (!sourceId) return
    const source = events.find((e) => e.id === sourceId)
    const shiftDays = source
      ? Math.round(
          (startOfDay(eventStart(target)).getTime() - startOfDay(eventStart(source)).getTime()) / DAY_MS
        )
      : 0
    setBusy(true)
    setError(null)
    try {
      await onCopy(sourceId, parts, shiftDays)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copia non riuscita.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-ink/60 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Copia scheda da un altro evento"
        onClick={(e) => e.stopPropagation()}
        className="ink-box flex max-h-[90dvh] w-full max-w-lg animate-sheet-up flex-col overflow-hidden bg-paper-hi sm:animate-stamp-in"
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-ink p-4">
          <div className="min-w-0">
            <p className="eyebrow">Copia scheda</p>
            <h2 className="mt-1 truncate font-display text-lg leading-tight font-black text-ink">
              su “{target.title}”
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi"
            className="tap shrink-0 border-2 border-ink bg-paper-hi p-2.5 text-ink transition-colors hover:bg-vermiglio hover:text-paper-hi sm:p-1.5"
          >
            <X size={15} />
          </button>
        </div>

        <div className="border-b-2 border-ink/20 p-3">
          <div className="relative">
            <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca l'edizione da copiare…"
              className="w-full border-2 border-ink bg-paper py-2 pr-2 pl-8 text-base text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-vermiglio sm:py-1.5 sm:text-sm"
            />
          </div>
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto overscroll-contain p-1.5">
          {sources.length === 0 && (
            <p className="p-3 text-xs text-ink-faint">
              Nessun evento con una scheda da cui copiare.
            </p>
          )}
          {sources.map((e) => {
            const ex = extrasOf(e.id)
            const on = sourceId === e.id
            return (
              <button
                key={e.id}
                onClick={() => setSourceId(e.id)}
                className={`flex w-full items-center gap-2 border-b border-ink/15 px-2 py-2 text-left transition-colors last:border-b-0 ${
                  on ? 'bg-ink text-paper-hi' : 'text-ink hover:bg-paper-2'
                }`}
              >
                {ex.thumb ? (
                  <img src={ex.thumb} alt="" className="h-9 w-9 shrink-0 border border-ink/30 object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-dashed border-ink/25 text-ink-faint">
                    <ImageIcon size={12} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{e.title}</span>
                  <span className={`block truncate text-[0.62rem] ${on ? 'text-paper-hi/70' : 'text-ink-faint'}`}>
                    {shortRange(e)}
                    {ex.links.length > 0 && ` · ${ex.links.length} link`}
                    {ex.note && ' · nota'}
                    {ex.programma.length > 0 && ' · programma'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="border-t-2 border-ink p-3">
          <p className="eyebrow mb-2">Cosa copiare</p>
          <div className="flex flex-wrap gap-1.5">
            <PartToggle on={parts.photos} onClick={() => setParts((p) => ({ ...p, photos: !p.photos }))}>
              Locandine
            </PartToggle>
            <PartToggle on={parts.links} onClick={() => setParts((p) => ({ ...p, links: !p.links }))}>
              Collegamenti
            </PartToggle>
            <PartToggle on={parts.note} onClick={() => setParts((p) => ({ ...p, note: !p.note }))}>
              Nota
            </PartToggle>
            <PartToggle
              on={parts.programma}
              onClick={() => setParts((p) => ({ ...p, programma: !p.programma }))}
            >
              Programma
            </PartToggle>
            <PartToggle on={parts.category} onClick={() => setParts((p) => ({ ...p, category: !p.category }))}>
              Categoria
            </PartToggle>
          </div>

          {willReplace && (
            <p className="mt-2 flex items-start gap-1.5 text-[0.68rem] font-semibold text-ink">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-vermiglio" />
              Le locandine già presenti su questo evento verranno sostituite.
            </p>
          )}
          {error && (
            <p className="mt-2 flex items-center gap-1.5 text-[0.68rem] font-semibold text-vermiglio">
              <AlertTriangle size={12} />
              {error}
            </p>
          )}

          <button
            onClick={handleCopy}
            disabled={busy || !sourceId || nothingChosen}
            className="stamp-btn tap mt-3 flex w-full items-center justify-center gap-2 bg-vermiglio px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi disabled:opacity-40 sm:py-2.5"
          >
            <Copy size={14} />
            {busy ? 'Copia in corso…' : sourceId ? 'Copia qui' : 'Scegli un evento'}
          </button>
        </div>
      </div>
    </div>
  )
}

