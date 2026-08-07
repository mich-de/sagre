import type { CalendarEvent } from './googleCalendar'

/* ---------------------------------------------------------------------------
 * Google Calendar, per gli eventi "tutto il giorno", restituisce una data di
 * fine ESCLUSIVA: una sagra dell'1-2 agosto arriva con end = 2026-08-03.
 * FullCalendar usa la stessa convenzione, quindi `event.end` resta grezzo e la
 * griglia disegna la barra della lunghezza giusta. Per ogni testo mostrato
 * all'utente serve invece la fine INCLUSIVA, altrimenti ogni sagra sembra
 * durare un giorno in più e quelle di un giorno solo sembrano durarne due.
 *
 * In più: `new Date('2026-08-01')` viene letto come mezzanotte UTC, non locale.
 * Nei fusi a ovest di Greenwich questo sposta indietro la data di un giorno,
 * perciò le date senza orario vengono costruite a mano nel fuso locale.
 * ------------------------------------------------------------------------- */

const DAY_MS = 86_400_000
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function parseEventDate(value: string): Date {
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

export function eventStart(event: CalendarEvent): Date {
  return parseEventDate(event.start)
}

/** Fine esclusiva: l'istante in cui l'evento non è più in corso. */
export function eventEndExclusive(event: CalendarEvent): Date {
  return parseEventDate(event.end)
}

/** Fine inclusiva: l'ultimo giorno da mostrare all'utente.
 *
 *  Con orario: una festa che va dalle 20:00 a mezzanotte in punto appartiene
 *  ancora al giorno in cui è cominciata. È la stessa soglia (`nextDayThreshold`)
 *  che usa FullCalendar per decidere se disegnare il blocco anche il giorno
 *  dopo — senza allinearsi, la griglia mostra un giorno e il testo ne annuncia
 *  due. Chi tira davvero fino all'una di notte resta a due giorni. */
export function eventEndInclusive(event: CalendarEvent): Date {
  const end = parseEventDate(event.end)
  const start = eventStart(event)

  if (!event.allDay) {
    const atMidnight = end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0
    if (!atMidnight) return end
    const previous = new Date(end.getTime() - 1)
    return previous < start ? start : previous
  }

  const inclusive = new Date(end.getTime() - DAY_MS)
  return inclusive < start ? start : inclusive
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

/** Quanti giorni di calendario copre l'evento (minimo 1). */
export function eventDayCount(event: CalendarEvent): number {
  const from = startOfDay(eventStart(event)).getTime()
  const to = startOfDay(eventEndInclusive(event)).getTime()
  return Math.max(1, Math.round((to - from) / DAY_MS) + 1)
}

export function isMultiDay(event: CalendarEvent): boolean {
  return eventDayCount(event) > 1
}

export function isOngoing(event: CalendarEvent, now: Date = new Date()): boolean {
  return eventStart(event) <= now && eventEndExclusive(event) > now
}

export function isOver(event: CalendarEvent, now: Date = new Date()): boolean {
  return eventEndExclusive(event) <= now
}

/* ------------------------------------------------------------- formati -- */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('it-IT', o)
const time = (d: Date) => d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

/** "12 ago" — per elenchi compatti e pastiglie. */
export function shortDate(value: string | Date): string {
  const d = typeof value === 'string' ? parseEventDate(value) : value
  return fmt(d, { day: 'numeric', month: 'short' })
}

/** Estremi dell'intervallo tenuti separati: il separatore lo disegna chi
 *  mostra la data, perché in Bodoni un trattino da titolo è un capello che
 *  sparisce. Vedi il componente `DateRange`. */
export function shortRangeParts(event: CalendarEvent): { from: string; to: string | null } {
  const from = eventStart(event)
  const to = eventEndInclusive(event)
  if (isSameDay(from, to)) return { from: shortDate(from), to: null }
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  return sameMonth
    ? { from: String(from.getDate()), to: `${to.getDate()} ${fmt(to, { month: 'short' })}` }
    : { from: shortDate(from), to: shortDate(to) }
}

/** Intervallo compatto in testo semplice: "12 ago" oppure "12 - 14 ago". */
export function shortRange(event: CalendarEvent): string {
  const { from, to } = shortRangeParts(event)
  return to ? `${from} - ${to}` : from
}

/** Riga distesa per la scheda evento. */
export function formatDateRange(event: CalendarEvent): string {
  const from = eventStart(event)
  const to = eventEndInclusive(event)
  const sameDay = isSameDay(from, to)

  if (event.allDay) {
    if (sameDay) return cap(fmt(from, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
    const fromStr = sameMonth
      ? fmt(from, { weekday: 'long', day: 'numeric' })
      : fmt(from, { weekday: 'long', day: 'numeric', month: 'long' })
    const toStr = fmt(to, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    return `Da ${fromStr} a ${toStr}`
  }

  /* Gli orari si leggono sempre sulla fine reale: l'inclusiva, per un evento
     che chiude a mezzanotte, è le 23:59:59.999 del giorno prima. */
  const until = eventEndExclusive(event)
  if (sameDay) {
    return `${cap(fmt(from, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${time(from)}–${time(until)}`
  }
  return `${cap(fmt(from, { weekday: 'short', day: 'numeric', month: 'short' }))} ${time(from)} → ${fmt(until, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} ${time(until)}`
}

/** "3 giorni" / "1 giorno" — usato come pastiglia sulle sagre lunghe. */
export function formatDuration(event: CalendarEvent): string {
  const days = eventDayCount(event)
  return days === 1 ? '1 giorno' : `${days} giorni`
}
