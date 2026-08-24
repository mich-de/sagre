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

/** Ora prima della quale la coda di una festa appartiene ancora alla sera
 *  precedente. I fuochi di Ferragosto finiscono all'una di notte del 16 ma
 *  restano la festa del 15: una sagra al giorno, non due mezze giornate.
 *  Lo stesso valore va passato a FullCalendar come `nextDayThreshold`,
 *  altrimenti la griglia e il testo raccontano due cose diverse. */
export const NEXT_DAY_HOUR = 6
export const NEXT_DAY_THRESHOLD = '06:00:00'

/** Fine inclusiva: l'ultimo giorno da mostrare all'utente. */
export function eventEndInclusive(event: CalendarEvent): Date {
  const end = parseEventDate(event.end)
  const start = eventStart(event)

  if (!event.allDay) {
    if (end.getHours() >= NEXT_DAY_HOUR) return end
    const previous = new Date(startOfDay(end).getTime() - 1)
    return previous < start ? start : previous
  }

  const inclusive = new Date(end.getTime() - DAY_MS)
  return inclusive < start ? start : inclusive
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

/** "2026-08-14", nel fuso locale. `toISOString` qui non va: converte in UTC e
 *  in Italia d'estate riporta indietro il giorno per tutto agosto. */
export function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}

/** Il fine settimana di cui si parla adesso: venerdì, sabato e domenica.
 *  Da lunedì a giovedì è quello che viene; da venerdì a domenica è quello in
 *  corso, non il prossimo — la domenica pomeriggio «questo fine settimana»
 *  vuol dire ancora oggi, non fra sei giorni. */
export function weekendWindow(now: Date = new Date()): { from: Date; to: Date } {
  const today = startOfDay(now)
  /* 0 domenica … 5 venerdì, 6 sabato. */
  const day = today.getDay()
  const toFriday = day === 0 ? -2 : day === 6 ? -1 : day === 5 ? 0 : 5 - day
  const from = addDays(today, toFriday)
  return { from, to: addDays(from, 2) }
}

/** Quanti giorni separano due date scritte 'AAAA-MM-GG'. Passa per
 *  `parseEventDate`, quindi l'ora legale non falsa il conto. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseEventDate(to).getTime() - parseEventDate(from).getTime()) / DAY_MS)
}

/** L'evento è in cartellone in quel giorno? Vale anche per le sagre lunghe,
 *  che occupano tutti i giorni tra inizio e fine inclusiva. */
export function occursOn(event: CalendarEvent, day: Date): boolean {
  const d = startOfDay(day).getTime()
  return (
    startOfDay(eventStart(event)).getTime() <= d && startOfDay(eventEndInclusive(event)).getTime() >= d
  )
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

  /* Il giorno si legge sulla fine inclusiva, l'ora sulla fine reale:
     l'inclusiva di una festa che chiude a mezzanotte è le 23:59:59.999. */
  const until = eventEndExclusive(event)
  if (sameDay) {
    return `${cap(fmt(from, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${time(from)}–${time(until)}`
  }
  return `${cap(fmt(from, { weekday: 'short', day: 'numeric', month: 'short' }))} ${time(from)} → ${fmt(to, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} ${time(until)}`
}

/** Solo l'orario d'inizio, per le righe d'elenco. */
export function startTime(event: CalendarEvent): string | null {
  return event.allDay ? null : time(eventStart(event))
}

/** "oggi", "ieri", "3 giorni fa", poi la data secca. Per la riga "ultima
 *  modifica": a chi cura le locandine interessa se è roba di stamattina. */
export function relativeDay(value: Date, now: Date = new Date()): string {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(value).getTime()) / DAY_MS)
  if (days <= 0) return 'oggi'
  if (days === 1) return 'ieri'
  if (days < 7) return `${days} giorni fa`
  return shortDate(value)
}

/** "Agosto 2026" — intestazione di sezione nell'elenco. */
export function monthLabel(d: Date): string {
  return cap(fmt(d, { month: 'long', year: 'numeric' }))
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface MonthGroup {
  key: string
  label: string
  events: CalendarEvent[]
}

/** Eventi divisi in capitoli mensili, in ordine di data. Lo stesso taglio lo
 *  usano l'elenco e l'indice dei mesi in cima: se lo calcolassero ognuno per
 *  conto suo, prima o poi mostrerebbero due cartelloni diversi. */
export function groupByMonth(events: CalendarEvent[]): MonthGroup[] {
  const sorted = [...events].sort((a, b) => eventStart(a).getTime() - eventStart(b).getTime())
  const groups: MonthGroup[] = []
  for (const event of sorted) {
    const start = eventStart(event)
    const key = monthKey(start)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.events.push(event)
    else groups.push({ key, label: monthLabel(start), events: [event] })
  }
  return groups
}

/** Ancora del capitolo: l'indice dei mesi ci salta sopra. */
export function monthAnchorId(key: string): string {
  return `mese-${key}`
}

/** "Ago" — etichetta cortissima per l'indice dei mesi. */
export function shortMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return cap(fmt(new Date(y, m - 1, 1), { month: 'short' })).replace('.', '')
}

/** "3 giorni" / "1 giorno" — usato come pastiglia sulle sagre lunghe. */
export function formatDuration(event: CalendarEvent): string {
  const days = eventDayCount(event)
  return days === 1 ? '1 giorno' : `${days} giorni`
}
