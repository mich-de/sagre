import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Save, Trash2 } from 'lucide-react'
import type { CalendarEvent } from '../../lib/googleCalendar'
import {
  cleanProgramma,
  dayLabel,
  MAX_PROGRAMMA_TEXT,
  orphanRows,
  programmaRows,
  type ProgrammaRow,
} from '../../lib/programma'

interface ProgrammaEditorProps {
  event: CalendarEvent
  /** Le righe come stanno su Firestore adesso. */
  initial: ProgrammaRow[]
  onSave: (rows: ProgrammaRow[]) => void
  busy?: boolean
}

/** Il programma giorno per giorno. Le righe non si aggiungono a mano: ci sono
 *  già tutte, una per ogni giorno della festa, e si scrive dentro quella
 *  giusta. Spostando le date dell'evento le righe rimaste fuori compaiono in
 *  fondo come «giorni che non fanno più parte della festa», perché buttarle via
 *  di nascosto vorrebbe dire perdere il lavoro di qualcuno. */
export function ProgrammaEditor({ event, initial, onSave, busy }: ProgrammaEditorProps) {
  const [rows, setRows] = useState<ProgrammaRow[]>(() => programmaRows(event, initial))
  const [orphans, setOrphans] = useState<ProgrammaRow[]>(() => orphanRows(event, initial))

  /* Si riparte da quel che c'è scritto quando cambia l'evento, quando cambiano
     le sue date (le righe sono agganciate ai giorni veri) o dopo un
     salvataggio. Non basta `event`: l'oggetto cambia identità a ogni rilettura
     del calendario, e lì dentro ci sarebbe ancora la riga che si sta
     scrivendo. */
  useEffect(() => {
    setRows(programmaRows(event, initial))
    setOrphans(orphanRows(event, initial))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, event.start, event.end, initial])

  const next = useMemo(() => cleanProgramma([...rows, ...orphans]), [rows, orphans])
  const dirty = useMemo(() => !sameRows(next, cleanProgramma(initial)), [next, initial])
  const filled = next.length

  const setText = (date: string, text: string) =>
    setRows((prev) => prev.map((r) => (r.date === date ? { ...r, text } : r)))

  return (
    <div className="border-2 border-ink/25 bg-paper-2 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-1.5">
          <CalendarClock size={12} />
          Programma
        </p>
        <span className="text-[0.6rem] text-ink-faint">
          {filled === 0 ? 'nessun giorno' : `${filled} di ${rows.length}`}
        </span>
      </div>

      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.date} className="flex items-center gap-2">
            <span className="w-[5.5rem] shrink-0 text-[0.62rem] font-bold tracking-wide uppercase text-ink-soft">
              {dayLabel(row.date)}
            </span>
            <input
              type="text"
              value={row.text}
              maxLength={MAX_PROGRAMMA_TEXT}
              onChange={(e) => setText(row.date, e.target.value)}
              placeholder="Stand aperti dalle 19, musica dal vivo…"
              className="min-w-0 flex-1 border-2 border-ink bg-paper px-2 py-2 text-base text-ink outline-none placeholder:text-ink-faint focus:bg-paper-hi focus:ring-2 focus:ring-vermiglio sm:py-1.5 sm:text-sm"
            />
          </li>
        ))}
      </ul>

      {orphans.length > 0 && (
        <div className="mt-2.5 border-t border-ink/20 pt-2">
          <p className="text-[0.6rem] leading-relaxed text-ink-faint">
            Righe scritte per giorni che la festa non copre più. Le date sono state spostate: qui si
            possono togliere.
          </p>
          <ul className="mt-1.5 space-y-1">
            {orphans.map((row) => (
              <li key={row.date} className="flex items-center gap-2">
                <span className="w-[5.5rem] shrink-0 text-[0.62rem] font-bold tracking-wide uppercase text-vermiglio">
                  {dayLabel(row.date)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">{row.text}</span>
                <button
                  type="button"
                  onClick={() => setOrphans((prev) => prev.filter((r) => r.date !== row.date))}
                  aria-label={`Togli la riga del ${dayLabel(row.date)}`}
                  className="tap shrink-0 border-2 border-ink bg-paper-hi p-1.5 text-ink transition-colors hover:bg-vermiglio hover:text-paper-hi"
                >
                  <Trash2 size={11} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dirty && (
        <button
          type="button"
          onClick={() => onSave(next)}
          disabled={busy}
          className="stamp-btn tap mt-2.5 flex w-full items-center justify-center gap-2 bg-vermiglio px-3 py-2.5 text-[0.62rem] font-bold tracking-[0.12em] uppercase text-paper-hi disabled:opacity-50 sm:py-2"
        >
          <Save size={12} />
          Salva il programma
        </button>
      )}
    </div>
  )
}

function sameRows(a: ProgrammaRow[], b: ProgrammaRow[]): boolean {
  return a.length === b.length && a.every((r, i) => r.date === b[i].date && r.text === b[i].text)
}
