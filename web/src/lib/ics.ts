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
  /* `BASE_URL` e non solo l'origine: il sito sta sotto /sagre/, e senza il
     percorso il link dentro ogni .ics porta a una pagina che non esiste. */
  const url = new URL(import.meta.env.BASE_URL, window.location.origin)
  /* La query va DENTRO il cancelletto, non prima: il router è un `HashRouter`
     e i suoi parametri li legge da lì (vedi `useHomeFilters`). Scritta fuori,
     `?e=` non arriva a nessuno e il collegamento apre il cartellone invece
     della sagra — che è il contrario di quel che serve a chi ha l'evento in
     agenda e vuole la locandina. */
  url.hash = `/?e=${encodeURIComponent(event.id)}`
  return url.toString()
}

/* ----------------------------------------------------------- abbonamento -- */

/* Il file scaricato è una fotografia: le sagre aggiunte dopo non ci entrano, e
 * chi l'ha scaricato in giugno ha un'agenda vecchia senza saperlo.
 * L'abbonamento invece è un indirizzo che il telefono ricontrolla da solo, e il
 * cartellone resta aggiornato senza che nessuno rifaccia il giro.
 *
 * L'indirizzo è quello iCal pubblico del calendario condiviso. Se il
 * calendario non è configurato non si finge: `null`, e il pulsante non compare
 * invece di portare a un errore. */

const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID as string | undefined

/** L'indirizzo da copiare e incollare, in https: buono per Google Calendar,
 *  che chiede l'indirizzo scritto a mano. */
export function subscriptionUrl(): string | null {
  if (!CALENDAR_ID) return null
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`
}

/** Lo stesso indirizzo in `webcal:`, che iPhone, Mac e Outlook riconoscono
 *  come "iscrivimi a questo calendario" invece di scaricare un file. */
export function webcalUrl(): string | null {
  const url = subscriptionUrl()
  return url && url.replace(/^https:/, 'webcal:')
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
