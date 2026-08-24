import type { CalendarEvent } from './googleCalendar'
import { addDays, eventDayCount, eventStart, isoDay, parseEventDate, startOfDay } from './dates'

/* ---------------------------------------------------------------------------
 * Il programma di una sagra non è un testo: è un giorno per volta. "Venerdì
 * stand aperti, sabato musica, domenica processione" scritto in un campo unico
 * è leggibile, ma il sito non sa che giorno è — e chi apre la scheda il sabato
 * vuole sapere cosa c'è stasera, non leggersi tre righe per trovare la sua.
 *
 * Perciò ogni riga è agganciata a una data vera, presa dai giorni dell'evento.
 * Il prezzo è che spostando le date della festa le righe restano indietro:
 * quelle rimaste fuori diventano "orfane" e l'ufficio manifesti le mostra a
 * parte invece di buttarle via di nascosto.
 * ------------------------------------------------------------------------- */

export interface ProgrammaRow {
  /** Giorno in formato aaaa-mm-gg, nel fuso locale. */
  date: string
  text: string
}

/** Una sagra più lunga di due settimane non esiste; il tetto serve a non far
 *  crescere il documento oltre il megabyte che Firestore concede. */
export const MAX_PROGRAMMA_DAYS = 21
export const MAX_PROGRAMMA_TEXT = 300

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const byDate = (a: ProgrammaRow, b: ProgrammaRow) => a.date.localeCompare(b.date)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** I giorni della festa, dal primo all'ultimo compreso. */
export function eventDays(event: CalendarEvent): string[] {
  const first = startOfDay(eventStart(event))
  const count = Math.min(eventDayCount(event), MAX_PROGRAMMA_DAYS)
  return Array.from({ length: count }, (_, i) => isoDay(addDays(first, i)))
}

/** Le righe da mostrare nel compilatore: una per ogni giorno della festa, col
 *  testo già scritto se c'è. Nessun giorno viene saltato, così si scrive dentro
 *  la riga giusta invece di doverla creare. */
export function programmaRows(event: CalendarEvent, saved: ProgrammaRow[]): ProgrammaRow[] {
  const byDate = new Map(saved.map((r) => [r.date, r.text]))
  return eventDays(event).map((date) => ({ date, text: byDate.get(date) ?? '' }))
}

/** Righe scritte per giorni che la festa non copre più: succede quando le date
 *  vengono spostate dopo aver compilato il programma. */
export function orphanRows(event: CalendarEvent, saved: ProgrammaRow[]): ProgrammaRow[] {
  const days = new Set(eventDays(event))
  return saved.filter((r) => r.text.trim() && !days.has(r.date)).sort(byDate)
}

/** Quel che finisce su Firestore: niente righe vuote, testo tagliato, in
 *  ordine di data. Un array vuoto vuol dire "nessun programma". */
export function cleanProgramma(rows: ProgrammaRow[]): ProgrammaRow[] {
  const seen = new Set<string>()
  const out: ProgrammaRow[] = []
  for (const row of rows) {
    const text = row.text.trim().slice(0, MAX_PROGRAMMA_TEXT)
    if (!text || !ISO_DAY.test(row.date) || seen.has(row.date)) continue
    seen.add(row.date)
    out.push({ date: row.date, text })
  }
  return out.sort(byDate).slice(0, MAX_PROGRAMMA_DAYS)
}

/** Sposta tutto il programma dello stesso numero di giorni: serve a chi ripete
 *  la sagra l'anno prossimo, dove il venerdì di apertura resta il venerdì di
 *  apertura anche se cade a un'altra data. */
export function shiftProgramma(rows: ProgrammaRow[], days: number): ProgrammaRow[] {
  if (!days) return rows
  return rows.map((row) => ({ ...row, date: isoDay(addDays(parseEventDate(row.date), days)) }))
}

/** Letto da Firestore, dove può esserci di tutto: documenti scritti da versioni
 *  precedenti, campi mancanti, tipi sbagliati. */
export function toProgramma(value: unknown): ProgrammaRow[] {
  if (!Array.isArray(value)) return []
  const rows: ProgrammaRow[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const { date, text } = item as Record<string, unknown>
    if (typeof date === 'string' && typeof text === 'string') rows.push({ date, text })
  }
  return cleanProgramma(rows)
}

/* ------------------------------------------------------------- formati -- */

/** "Ven 14 ago" — etichetta della riga, corta perché le sta accanto. */
export function dayLabel(date: string): string {
  const d = parseEventDate(date)
  return cap(d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })).replace(
    /\./g,
    ''
  )
}

/** La riga di oggi, se la festa è in corso: la scheda pubblica la mette in
 *  evidenza, ed è l'unica ragione per cui le righe hanno una data vera. */
export function todayRow(rows: ProgrammaRow[], now: Date = new Date()): ProgrammaRow | null {
  const today = isoDay(now)
  return rows.find((r) => r.date === today) ?? null
}
