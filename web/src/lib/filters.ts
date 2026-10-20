import type { CalendarEvent } from './googleCalendar'
import {
  addDays,
  eventEndInclusive,
  eventStart,
  isOver,
  parseEventDate,
  startOfDay,
  weekendWindow,
} from './dates'

/* ---------------------------------------------------------------------------
 * Filtri e ordinamento del cartellone, tenuti fuori dai componenti perché li
 * usano in tre: la barra dei filtri per disegnarsi, la home per filtrare,
 * l'indirizzo del browser per ricordarseli.
 * ------------------------------------------------------------------------- */

export type CalendarViewMode = 'grid' | 'list' | 'map'
export type TimeRange = 'futuri' | 'weekend' | 'settimana' | 'tutti' | 'intervallo'
export type SortKey = 'prossimi' | 'recenti' | 'alfabetico'

export const RANGES: Array<{ key: TimeRange; label: string }> = [
  { key: 'futuri', label: 'In arrivo' },
  { key: 'weekend', label: 'Questo fine settimana' },
  { key: 'settimana', label: 'Prossimi 7 giorni' },
  { key: 'tutti', label: 'Tutto lo storico' },
  { key: 'intervallo', label: 'Da… a…' },
]

export const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: 'prossimi', label: 'Prima i prossimi' },
  { key: 'recenti', label: 'Ultimi aggiunti' },
  { key: 'alfabetico', label: 'Ordine alfabetico' },
]

/** Finestra temporale dell'elenco. L'intervallo su misura si misura sulla
 *  sovrapposizione, non sull'inizio: una sagra di tre giorni che comincia il
 *  giorno prima del "da" è comunque in cartellone dentro l'intervallo. */
export function inTimeRange(
  event: CalendarEvent,
  range: TimeRange,
  from: string,
  to: string,
  now: Date = new Date()
): boolean {
  if (range === 'intervallo') {
    if (from && startOfDay(eventEndInclusive(event)) < parseEventDate(from)) return false
    if (to && startOfDay(eventStart(event)) > parseEventDate(to)) return false
    return true
  }
  if (range === 'tutti') return true
  if (isOver(event, now)) return false
  if (range === 'settimana' && eventStart(event) >= addDays(startOfDay(now), 8)) return false
  if (range === 'weekend') {
    /* Come l'intervallo su misura, per sovrapposizione: una sagra che comincia
       il giovedì e finisce la domenica è una sagra del fine settimana. */
    const { from: friday, to: sunday } = weekendWindow(now)
    if (startOfDay(eventEndInclusive(event)) < friday) return false
    if (startOfDay(eventStart(event)) > sunday) return false
  }
  return true
}

/** Accende o spegne una categoria. Sta qui perché la scelta dei colori si fa
 *  da due posti — la barra dei filtri e la legenda in fondo alla pagina — e
 *  devono comportarsi allo stesso modo. */
export function toggleCategory(categories: string[], key: string): string[] {
  return categories.includes(key) ? categories.filter((k) => k !== key) : [...categories, key]
}

/** `recenti` guarda quando l'evento è stato scritto sul calendario, non quando
 *  si svolge: serve a vedere cosa è comparso da poco. */
export function sortEvents(events: CalendarEvent[], sort: SortKey): CalendarEvent[] {
  const list = [...events]
  if (sort === 'alfabetico') return list.sort((a, b) => a.title.localeCompare(b.title, 'it'))
  if (sort === 'recenti') return list.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''))
  return list.sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
}
