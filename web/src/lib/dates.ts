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

/** Fine inclusiva: l'ultimo giorno/istante da mostrare all'utente. */
export function eventEndInclusive(event: CalendarEvent): Date {
  const end = parseEventDate(event.end)
  if (!event.allDay) return end
  const inclusive = new Date(end.getTime() - DAY_MS)
  const start = eventStart(event)
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

/** Intervallo compatto: "12 ago" oppure "12–14 ago". */
export function shortRange(event: CalendarEvent): string {
  const from = eventStart(event)
  const to = eventEndInclusive(event)
  if (isSameDay(from, to)) return shortDate(from)
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  return sameMonth
    ? `${from.getDate()}–${to.getDate()} ${fmt(to, { month: 'short' })}`
    : `${shortDate(from)} – ${shortDate(to)}`
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

  if (sameDay) {
    return `${cap(fmt(from, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${time(from)}–${time(to)}`
  }
  return `${cap(fmt(from, { weekday: 'short', day: 'numeric', month: 'short' }))} ${time(from)} → ${fmt(to, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} ${time(to)}`
}

/** "3 giorni" / "1 giorno" — usato come pastiglia sulle sagre lunghe. */
export function formatDuration(event: CalendarEvent): string {
  const days = eventDayCount(event)
  return days === 1 ? '1 giorno' : `${days} giorni`
}
