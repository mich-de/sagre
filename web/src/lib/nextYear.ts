import { addDays, isoDay, parseEventDate, startOfDay } from './dates'
import type { EventDraft } from './calendarWrite'

/* ---------------------------------------------------------------------------
 * Una sagra torna ogni anno quasi identica, e riscriverla da zero è la parte
 * più noiosa del lavoro. Ma "l'anno prossimo" non vuol dire una cosa sola:
 *
 * - la festa patronale è legata a una DATA (San Rocco è il 16 agosto, che
 *   cada di lunedì o di sabato);
 * - la sagra di paese è legata a un GIORNO DELLA SETTIMANA (il secondo fine
 *   settimana di agosto), e spostata di data secca finirebbe di mercoledì.
 *
 * Nessuno dei due modi indovina sempre, perciò si offrono entrambi e le date
 * restano modificabili a mano. Quel che questo modulo garantisce è che lo
 * spostamento sia un numero di giorni: inizio, fine e righe del programma
 * slittano tutti dello stesso scarto, e la durata della festa non cambia.
 * ------------------------------------------------------------------------- */

export type RepeatMode = 'data' | 'giorno'

const DAY_MS = 86_400_000
const WEEK = 7

/** La stessa data l'anno dopo. Il 29 febbraio diventa il 28: senza questo
 *  controllo `new Date(2027, 1, 29)` scivola al 1° marzo. */
function sameDateNextYear(start: Date): Date {
  const year = start.getFullYear() + 1
  const month = start.getMonth()
  const day = start.getDate()
  const candidate = new Date(year, month, day)
  return candidate.getMonth() === month ? candidate : new Date(year, month + 1, 0)
}

/** Di quanti giorni spostare la festa per portarla all'anno prossimo.
 *  Col modo `giorno` si scelgono 52 o 53 settimane, quella che cade più vicino
 *  alla data di partenza: così il venerdì resta venerdì e la festa non si
 *  sposta di una settimana intera nel calendario. */
export function nextYearShift(startDate: string, mode: RepeatMode): number {
  const start = startOfDay(parseEventDate(startDate))
  const target = Math.round((sameDateNextYear(start).getTime() - start.getTime()) / DAY_MS)
  if (mode === 'data') return target
  const candidates = [52 * WEEK, 53 * WEEK]
  return candidates.reduce((best, d) =>
    Math.abs(d - target) < Math.abs(best - target) ? d : best
  )
}

/** Inizio e fine slittati dello stesso scarto: gli orari non si toccano, una
 *  sagra che apre alle 19 apre alle 19 anche l'anno prossimo. */
export function shiftDraft(draft: EventDraft, days: number): EventDraft {
  if (!days) return draft
  const move = (value: string) => isoDay(addDays(parseEventDate(value), days))
  return { ...draft, startDate: move(draft.startDate), endDate: move(draft.endDate) }
}
