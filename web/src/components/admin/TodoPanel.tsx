import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardCheck, PartyPopper } from 'lucide-react'
import type { CalendarEvent } from '../../lib/googleCalendar'
import { hasPoster, type EventExtras } from '../../lib/posters'
import { placeOf } from '../../lib/places'
import { eventStart, isOver, shortRange } from '../../lib/dates'

interface TodoPanelProps {
  events: CalendarEvent[]
  extrasOf: (eventId: string) => EventExtras
  /** Porta all'evento da sistemare: l'elenco serve per lavorarci, non per
   *  guardarlo. */
  onPick: (eventId: string) => void
  loading?: boolean
}

/* ---------------------------------------------------------------------------
 * Cosa manca. Le quattro metriche in cima dicono quante locandine ci sono, non
 * quali sagre aspettano ancora qualcosa: sono un termometro, non una lista di
 * lavori. Questo pannello guarda solo le feste ancora da fare — su quelle
 * passate non c'è più niente da rimediare — e per ogni mancanza dà i nomi.
 * ------------------------------------------------------------------------- */

interface Check {
  key: string
  label: string
  /** Perché conta: senza il motivo l'elenco sembra pedanteria. */
  why: string
  missing: (event: CalendarEvent, extras: EventExtras) => boolean
}

const CHECKS: Check[] = [
  {
    key: 'locandina',
    label: 'Senza locandina',
    why: 'Nel cartellone restano un rettangolo vuoto e il solo titolo.',
    missing: (_e, ex) => !hasPoster(ex),
  },
  {
    key: 'paese',
    label: 'Luogo senza paese',
    why: 'Dal campo luogo non si capisce il comune: la sagra sfugge ai filtri per paese.',
    missing: (e) => !placeOf(e.location),
  },
  {
    key: 'orari',
    label: 'Senza orari',
    why: 'Dura tutto il giorno: chi legge non sa a che ora si apre.',
    missing: (e) => e.allDay,
  },
  {
    key: 'programma',
    label: 'Senza programma',
    why: 'Niente da leggere giorno per giorno sulla scheda.',
    missing: (_e, ex) => ex.programma.length === 0,
  },
  {
    key: 'collegamenti',
    label: 'Senza collegamenti',
    why: 'Nessuna pagina o numero a cui mandare chi vuole saperne di più.',
    missing: (_e, ex) => ex.links.length === 0,
  },
]

export function TodoPanel({ events, extrasOf, onPick, loading }: TodoPanelProps) {
  const [open, setOpen] = useState(false)
  /* Una mancanza aperta alla volta: cinque elenchi aperti insieme sono una
     seconda pagina, e il bersaglio da toccare finisce fuori schermo. */
  const [shown, setShown] = useState<string | null>(null)

  const { rows, upcoming, todo } = useMemo(() => {
    /* Le più vicine in cima: quel che manca a una festa fra tre giorni è più
       urgente di quel che manca a una di settembre. */
    const soon = events
      .filter((e) => !isOver(e))
      .sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
    const found = CHECKS.map((check) => ({
      check,
      events: soon.filter((e) => check.missing(e, extrasOf(e.id))),
    }))
    return {
      rows: found,
      upcoming: soon.length,
      todo: found.reduce((n, r) => n + r.events.length, 0),
    }
  }, [events, extrasOf])

  if (loading) return null
  if (upcoming === 0) return null

  return (
    <div className="ink-box-sm mb-5 bg-paper-hi">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="tap flex w-full items-center gap-2.5 p-3 text-left"
      >
        {todo === 0 ? (
          <PartyPopper size={16} className="shrink-0 text-oliva" />
        ) : (
          <ClipboardCheck size={16} className="shrink-0 text-vermiglio" />
        )}
        <span className="min-w-0 flex-1">
          <span className="eyebrow block">Cosa manca</span>
          <span className="mt-0.5 block text-[0.72rem] leading-snug text-ink-soft">
            {todo === 0
              ? `Le ${upcoming} sagre in arrivo sono complete.`
              : `${todo} ${todo === 1 ? 'cosa' : 'cose'} da sistemare sulle ${upcoming} sagre in arrivo.`}
          </span>
        </span>
        {open ? (
          <ChevronDown size={15} className="shrink-0 text-ink-faint" />
        ) : (
          <ChevronRight size={15} className="shrink-0 text-ink-faint" />
        )}
      </button>

      {open && (
        <div className="border-t-2 border-ink">
          {rows.map(({ check, events: missing }) => {
            const isShown = shown === check.key
            return (
              <div key={check.key} className="border-b border-ink/15 last:border-b-0">
                <button
                  onClick={() => setShown(isShown ? null : check.key)}
                  disabled={missing.length === 0}
                  aria-expanded={isShown}
                  className="tap flex w-full items-center gap-2 px-3 py-2.5 text-left disabled:opacity-45"
                >
                  <span
                    className={`min-w-[2.2rem] shrink-0 border-2 px-1 py-0.5 text-center font-display text-sm leading-none font-black ${
                      missing.length === 0
                        ? 'border-ink/20 text-ink-faint'
                        : 'border-ink bg-senape/30 text-ink'
                    }`}
                  >
                    {missing.length}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.68rem] font-bold tracking-[0.08em] uppercase text-ink">
                      {check.label}
                    </span>
                    <span className="mt-0.5 block text-[0.62rem] leading-snug text-ink-faint">
                      {check.why}
                    </span>
                  </span>
                  {missing.length > 0 &&
                    (isShown ? (
                      <ChevronDown size={13} className="shrink-0 text-ink-faint" />
                    ) : (
                      <ChevronRight size={13} className="shrink-0 text-ink-faint" />
                    ))}
                </button>

                {isShown && (
                  <ul className="bg-paper-2 px-3 pb-2.5">
                    {missing.map((e) => (
                      <li key={e.id}>
                        <button
                          onClick={() => onPick(e.id)}
                          className="tap flex w-full items-baseline gap-2 border-b border-ink/10 py-2 text-left last:border-b-0 hover:text-vermiglio"
                        >
                          <span className="min-w-0 flex-1 truncate text-[0.72rem] font-semibold text-ink">
                            {e.title}
                          </span>
                          <span className="shrink-0 text-[0.6rem] whitespace-nowrap text-ink-faint">
                            {shortRange(e)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
