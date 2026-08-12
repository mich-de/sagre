import type { CalendarEvent } from './googleCalendar'
import { normalizePlace } from './places'

/* ---------------------------------------------------------------------------
 * "Segna in agenda" apre Google Calendar, e va bene per metà del paese.
 * L'altra metà ha un iPhone, o Outlook dell'ufficio, e su quel pulsante non ci
 * clicca due volte. Un file .ics lo aprono tutti, non chiede account e non
 * manda nessuno su un sito terzo: è il minimo comun denominatore dei
 * calendari da trent'anni.
 *
 * Il formato è RFC 5545: righe separate da CRLF, piegate a 75 ottetti,
 * caratteri speciali con la barra rovescia davanti. Sono dettagli che nessuno
 * vede finché un calendario non rifiuta il file senza dire perché.
 * ------------------------------------------------------------------------- */

const CRLF = '\r\n'
const PRODID = '-//Eventi e Sagre//Cartellone di paese//IT'

/** Barra rovescia, punto e virgola, virgola e a capo vanno protetti: nel
 *  formato sono separatori, e una sagra intitolata "Pane, amore e fantasia"
 *  diventerebbe due campi. */
function esc(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Piegatura a 75 ottetti, non a 75 caratteri: le lettere accentate ne
 *  occupano due, e tagliare in mezzo a una "à" produce un file illeggibile. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line

  const out: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const width = new TextEncoder().encode(char).length
    /* Dalla seconda riga in poi lo spazio iniziale conta come ottetto. */
    const limit = out.length === 0 ? 75 : 74
    if (size + width > limit) {
      out.push(current)
      current = ''
      size = 0
    }
    current += char
    size += width
  }
  if (current) out.push(current)
  return out.join(`${CRLF} `)
}

function utcStamp(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/** Le date senza orario vanno in formato aaaammgg, e la fine è ESCLUSIVA:
 *  è la stessa convenzione di Google Calendar, quindi qui non si converte
 *  niente. Toccarla sarebbe l'errore classico — una sagra lunga un giorno in
 *  meno su ogni telefono del paese. */
function dateOnly(value: string): string {
  return value.slice(0, 10).replace(/-/g, '')
}

function vevent(event: CalendarEvent, stamp: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${event.id}@eventi-e-sagre`, `DTSTAMP:${stamp}`]

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(event.start)}`)
    lines.push(`DTEND;VALUE=DATE:${dateOnly(event.end)}`)
  } else {
    lines.push(`DTSTART:${utcStamp(new Date(event.start))}`)
    lines.push(`DTEND:${utcStamp(new Date(event.end))}`)
  }

  lines.push(`SUMMARY:${esc(event.title)}`)
  if (event.location) lines.push(`LOCATION:${esc(event.location)}`)
  if (event.description) lines.push(`DESCRIPTION:${esc(event.description)}`)
  /* L'indirizzo della scheda, non quello di Google: chi apre l'evento dal
     proprio calendario torna al cartellone, dove ci sono locandina e meteo. */
  lines.push(`URL:${esc(eventPageUrl(event))}`)
  lines.push('END:VEVENT')
  return lines
}

export function eventPageUrl(event: CalendarEvent): string {
  const url = new URL(window.location.origin)
  url.searchParams.set('e', event.id)
  return url.toString()
}

/** Il file, pronto da scrivere su disco. */
export function buildIcs(events: CalendarEvent[], name: string): string {
  const stamp = utcStamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    ...events.flatMap((e) => vevent(e, stamp)),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join(CRLF) + CRLF
}

/** Nome del file: leggibile nella cartella Download, senza accenti né spazi. */
export function icsFileName(title: string): string {
  const slug = normalizePlace(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `${slug || 'cartellone'}.ics`
}

export function downloadIcs(events: CalendarEvent[], name: string, fileName: string): void {
  const blob = new Blob([buildIcs(events, name)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  /* L'indirizzo temporaneo va liberato, ma non prima che il browser abbia
     cominciato a scaricare: revocarlo nello stesso giro annulla il download
     su Safari. */
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
