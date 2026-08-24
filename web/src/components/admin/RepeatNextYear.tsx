import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarSync, X } from 'lucide-react'
import type { CalendarEvent } from '../../lib/googleCalendar'
import { hasPoster, type EventExtras, type CopyParts } from '../../lib/posters'
import { draftFrom, type EventDraft } from '../../lib/calendarWrite'
import { nextYearShift, shiftDraft, type RepeatMode } from '../../lib/nextYear'
import { addDays, daysBetween, isoDay, parseEventDate } from '../../lib/dates'
import { PartToggle } from './PartToggle'

interface RepeatNextYearProps {
  event: CalendarEvent
  extras: EventExtras
  onClose: () => void
  /** `shiftDays` è lo scarto vero fra le due edizioni, date corrette a mano
   *  comprese: serve a far slittare le righe del programma insieme alla festa. */
  onCreate: (draft: EventDraft, parts: CopyParts, shiftDays: number) => Promise<void>
}

const MODES: Array<{ key: RepeatMode; label: string; why: string }> = [
  {
    key: 'giorno',
    label: 'Stesso giorno della settimana',
    why: 'Per le sagre del secondo fine settimana di agosto: il venerdì resta venerdì.',
  },
  {
    key: 'data',
    label: 'Stessa data',
    why: 'Per le feste patronali: San Rocco è il 16 agosto, che cada di lunedì o di sabato.',
  },
]

/** Duplica una sagra spostandola all'anno prossimo. Le date proposte si vedono
 *  sempre in chiaro e si possono correggere: nessuno dei due modi indovina
 *  ogni volta, e una festa scritta sulla data sbagliata è peggio di una festa
 *  da riscrivere a mano. */
export function RepeatNextYear({ event, extras, onClose, onCreate }: RepeatNextYearProps) {
  const base = useMemo(() => draftFrom(event), [event])
  const [mode, setMode] = useState<RepeatMode>('giorno')
  /* Le date modificate a mano vincono sul modo scelto, ma cambiare modo le
     ricalcola: sono due gesti diversi e vanno tenuti distinti. */
  const [override, setOverride] = useState<{ startDate: string; endDate: string } | null>(null)
  const [parts, setParts] = useState<CopyParts>({
    photos: true,
    links: true,
    note: true,
    programma: true,
    category: true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const proposed = useMemo(() => shiftDraft(base, nextYearShift(base.startDate, mode)), [base, mode])
  const draft: EventDraft = override ? { ...proposed, ...override } : proposed
  const shiftDays = daysBetween(base.startDate, draft.startDate)
  const backwards = draft.endDate < draft.startDate

  const has = {
    photos: hasPoster(extras),
    links: extras.links.length > 0,
    note: Boolean(extras.note),
    programma: extras.programma.length > 0,
    category: Boolean(extras.category),
  }
  const nothingToCarry = !Object.values(has).some(Boolean)

  function pickMode(next: RepeatMode) {
    setMode(next)
    setOverride(null)
  }

  function setDate(field: 'startDate' | 'endDate', value: string) {
    setOverride((prev) => {
      const current = prev ?? { startDate: proposed.startDate, endDate: proposed.endDate }
      const next = { ...current, [field]: value }
      /* La fine segue l'inizio quando resterebbe indietro, come nel modulo
         degli eventi: nessuno scrive apposta una sagra che finisce prima di
         cominciare. Lo scarto fra le due date è la durata della festa. */
      if (field === 'startDate' && value) {
        const dur = daysBetween(current.startDate, current.endDate)
        next.endDate = isoDay(addDays(parseEventDate(value), dur))
      }
      return next
    })
  }

  async function handleCreate() {
    if (backwards) {
      setError('La fine viene prima dell’inizio.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onCreate(draft, parts, shiftDays)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Non è stato possibile creare l’evento.')
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
        aria-label="Ripeti la sagra l'anno prossimo"
        onClick={(e) => e.stopPropagation()}
        className="ink-box flex max-h-[92dvh] w-full max-w-lg animate-sheet-up flex-col overflow-hidden bg-paper-hi sm:animate-stamp-in"
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-ink p-4">
          <div className="min-w-0">
            <p className="eyebrow">Ripeti l’anno prossimo</p>
            <h2 className="mt-1 truncate font-display text-lg leading-tight font-black text-ink">
              {event.title}
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

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <div>
            <p className="eyebrow mb-2">Come si sposta</p>
            <div className="space-y-1.5">
              {MODES.map((m) => {
                const on = mode === m.key
                const days = nextYearShift(base.startDate, m.key)
                const preview = shiftDraft(base, days)
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => pickMode(m.key)}
                    aria-pressed={on}
                    className={`block w-full border-2 p-2.5 text-left transition-colors ${
                      on ? 'border-ink bg-paper-2' : 'border-ink/25 hover:border-ink'
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[0.68rem] font-bold tracking-[0.08em] uppercase text-ink">
                        {m.label}
                      </span>
                      <span className="shrink-0 font-display text-sm font-black whitespace-nowrap text-vermiglio">
                        {rangeLabel(preview.startDate, preview.endDate)}
                      </span>
                    </span>
                    <span className="mt-1 block text-[0.62rem] leading-relaxed text-ink-faint">{m.why}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow mb-1 block">Inizio</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDate('startDate', e.target.value)}
                className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-base text-ink outline-none focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:py-2 sm:text-sm"
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-1 block">{draft.allDay ? 'Ultimo giorno' : 'Fine'}</span>
              <input
                type="date"
                min={draft.startDate}
                value={draft.endDate}
                onChange={(e) => setDate('endDate', e.target.value)}
                className="w-full border-2 border-ink bg-paper px-3 py-2.5 text-base text-ink outline-none focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:py-2 sm:text-sm"
              />
            </label>
          </div>

          <p className="border-2 border-ink/25 bg-paper-2 p-2.5 text-[0.65rem] leading-relaxed text-ink-soft">
            Titolo, luogo, descrizione e orari restano quelli di quest’anno, e si correggono dopo con
            «Date e testi». L’evento vecchio non viene toccato.
          </p>

          <div>
            <p className="eyebrow mb-2">Cosa portarsi dietro</p>
            {nothingToCarry ? (
              <p className="text-[0.65rem] text-ink-faint">
                Questa sagra non ha ancora locandina, collegamenti, nota o programma: c’è solo la data da
                ripetere.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {has.photos && (
                  <PartToggle on={parts.photos} onClick={() => setParts((p) => ({ ...p, photos: !p.photos }))}>
                    Locandine
                  </PartToggle>
                )}
                {has.links && (
                  <PartToggle on={parts.links} onClick={() => setParts((p) => ({ ...p, links: !p.links }))}>
                    Collegamenti
                  </PartToggle>
                )}
                {has.note && (
                  <PartToggle on={parts.note} onClick={() => setParts((p) => ({ ...p, note: !p.note }))}>
                    Nota
                  </PartToggle>
                )}
                {has.programma && (
                  <PartToggle
                    on={parts.programma}
                    onClick={() => setParts((p) => ({ ...p, programma: !p.programma }))}
                  >
                    Programma
                  </PartToggle>
                )}
                {has.category && (
                  <PartToggle
                    on={parts.category}
                    onClick={() => setParts((p) => ({ ...p, category: !p.category }))}
                  >
                    Categoria
                  </PartToggle>
                )}
              </div>
            )}
            {has.programma && parts.programma && (
              <p className="mt-2 text-[0.62rem] leading-relaxed text-ink-faint">
                Il programma slitta con la festa: {extras.programma.length}{' '}
                {extras.programma.length === 1 ? 'riga' : 'righe'} spostate di {shiftDays} giorni.
              </p>
            )}
          </div>

          {error && (
            <p className="flex items-start gap-1.5 border-2 border-vermiglio bg-vermiglio/10 p-2.5 text-[0.7rem] font-semibold text-ink">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-vermiglio" />
              {error}
            </p>
          )}
        </div>

        <div className="border-t-2 border-ink p-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || backwards}
            className="stamp-btn tap flex w-full items-center justify-center gap-2 bg-vermiglio px-4 py-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase text-paper-hi disabled:opacity-40 sm:py-2.5"
          >
            <CalendarSync size={14} />
            {busy ? 'Creo…' : `Crea per ${rangeLabel(draft.startDate, draft.endDate)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/** "ven 14 – dom 16 ago 2027". Non si riusa `formatDateRange`: quello parte da
 *  un `CalendarEvent`, e qui l'evento non esiste ancora. */
function rangeLabel(startDate: string, endDate: string): string {
  const from = parseEventDate(startDate)
  const to = parseEventDate(endDate)
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
  const clean = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('it-IT', o).replace(/\./g, '')
  if (startDate === endDate) return clean(from, { ...opts, year: 'numeric' })
  return `${clean(from, opts)} – ${clean(to, { ...opts, year: 'numeric' })}`
}
