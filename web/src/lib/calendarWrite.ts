/* ---------------------------------------------------------------------------
 * Scrivere sul calendario: creare una sagra, spostarne le date, cancellarla.
 * Legge invece `googleCalendar.ts`, che gli basta la chiave API.
 *
 * Attenzione alla data di fine: Google la vuole ESCLUSIVA per gli eventi di
 * tutto il giorno (una sagra dell'1-2 agosto finisce il 3), mentre chi compila
 * il modulo scrive l'ultimo giorno di festa. La conversione sta tutta qui.
 * ------------------------------------------------------------------------- */

import { accessToken } from './googleAuth'
import { addDays, eventEndExclusive, eventEndInclusive, eventStart, isoDay, parseEventDate } from './dates'
import { toCalendarEvent, type CalendarEvent, type GCalEvent } from './googleCalendar'

const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID as string | undefined
const BASE = 'https://www.googleapis.com/calendar/v3/calendars'

export interface EventDraft {
  title: string
  location: string
  description: string
  allDay: boolean
  /** 'AAAA-MM-GG' */
  startDate: string
  /** Per gli eventi di tutto il giorno è l'ULTIMO giorno di festa, non quello
   *  dopo: la conversione alla fine esclusiva la fa `toBody`. */
  endDate: string
  /** 'HH:MM', ignorati quando è tutto il giorno. */
  startTime: string
  endTime: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const isoTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Gli eventi che si ripetono arrivano già "srotolati" in singole date, e
 *  hanno un id fatto di serie + giorno. Toccarne uno vale solo per quella
 *  data: chi modifica deve saperlo prima, non dopo. */
const INSTANCE_ID = /_\d{8}(t\d{6}z)?$/i
export const isRecurringInstance = (id: string) => INSTANCE_ID.test(id)

export function emptyDraft(day: Date = new Date()): EventDraft {
  const date = isoDay(day)
  return {
    title: '',
    location: '',
    description: '',
    allDay: true,
    startDate: date,
    endDate: date,
    startTime: '18:00',
    endTime: '23:30',
  }
}

export function draftFrom(event: CalendarEvent): EventDraft {
  const start = eventStart(event)
  const until = eventEndExclusive(event)
  return {
    title: event.title === '(senza titolo)' ? '' : event.title,
    location: event.location,
    description: event.description,
    allDay: event.allDay,
    startDate: isoDay(start),
    /* Tutto il giorno: si mostra l'ultimo giorno di festa. Con l'orario
       invece conta l'istante vero in cui si chiude, anche dopo mezzanotte. */
    endDate: isoDay(event.allDay ? eventEndInclusive(event) : until),
    startTime: isoTime(start),
    endTime: isoTime(until),
  }
}

/** Controllo prima di chiamare Google: gli errori dell'API sono in inglese e
 *  non dicono quale campo è sbagliato. */
export function validateDraft(draft: EventDraft): string | null {
  if (!draft.title.trim()) return 'Serve un titolo.'
  if (!draft.startDate) return 'Serve la data d’inizio.'
  if (!draft.endDate) return 'Serve la data di fine.'
  if (draft.endDate < draft.startDate) return 'La fine viene prima dell’inizio.'
  if (!draft.allDay) {
    if (!draft.startTime || !draft.endTime) return 'Servono l’ora d’inizio e quella di fine.'
    if (draft.startDate === draft.endDate && draft.endTime <= draft.startTime) {
      return 'L’ora di fine viene prima di quella d’inizio. Se la festa sconfina, sposta avanti la data di fine.'
    }
  }
  return null
}

function toBody(draft: EventDraft) {
  /* Campi sempre presenti anche se vuoti: su Google una stringa vuota
     cancella il vecchio valore, un campo assente lo lascia com'era. */
  const body: Record<string, unknown> = {
    summary: draft.title.trim(),
    location: draft.location.trim(),
    description: draft.description.trim(),
  }

  if (draft.allDay) {
    body.start = { date: draft.startDate }
    body.end = { date: isoDay(addDays(parseEventDate(draft.endDate), 1)) }
  } else {
    /* Niente fuso scritto a mano nella data: si dichiara a parte, così
       l'ora resta quella del posto anche quando cambia l'ora legale. */
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    body.start = { dateTime: `${draft.startDate}T${draft.startTime}:00`, timeZone }
    body.end = { dateTime: `${draft.endDate}T${draft.endTime}:00`, timeZone }
  }

  return body
}

async function call(path: string, init: RequestInit): Promise<Response> {
  if (!CALENDAR_ID) throw new Error('Calendario non configurato: manca VITE_GOOGLE_CALENDAR_ID.')
  const token = await accessToken()
  const res = await fetch(`${BASE}/${encodeURIComponent(CALENDAR_ID)}/events${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(await readError(res))
  return res
}

async function readError(res: Response): Promise<string> {
  if (res.status === 401) return 'Il collegamento a Google è scaduto. Ricollegalo e riprova.'
  if (res.status === 403) {
    return 'L’account Google collegato non può scrivere su questo calendario. Collega quello che lo possiede.'
  }
  if (res.status === 404) return 'Evento non trovato: forse è già stato cancellato.'
  const body = await res.text().catch(() => '')
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } }
    if (parsed.error?.message) return `Google ha risposto: ${parsed.error.message}`
  } catch {
    /* corpo non leggibile: si ripiega sul codice */
  }
  return `Errore di Google Calendar (${res.status}).`
}

/** `sendUpdates=none`: il calendario delle sagre non ha invitati da avvisare,
 *  e nessuno vuole una raffica di email a ogni correzione di orario. */
const QUIET = '?sendUpdates=none'

/* Si restituisce l'evento intero, non solo il suo id: la risposta di Google è
   già l'evento come lui l'ha registrato — date normalizzate comprese — ed è
   l'unica copia certa finché la lettura pubblica non si aggiorna. Vedi
   `useCalendarEvents`, che la tiene da parte proprio per quell'attesa. */
export async function createEvent(draft: EventDraft): Promise<CalendarEvent> {
  const res = await call(QUIET, { method: 'POST', body: JSON.stringify(toBody(draft)) })
  return toCalendarEvent((await res.json()) as GCalEvent)
}

export interface CreateManyReport {
  saved: CalendarEvent[]
  /** Chi non ce l'ha fatta. L'indice è quello nell'elenco passato: serve a chi
   *  chiama per ritrovare la riga esatta, che il titolo da solo non basta —
   *  due paesi vicini fanno la sagra della salsiccia lo stesso fine settimana. */
  failed: Array<{ index: number; title: string; error: string }>
}

/** Tante sagre in fila, una per volta. Non in parallelo: una raffica di venti
 *  scritture insieme si prende un errore di quota di Google e lascia il
 *  cartellone a metà, com'è già scritto in `runBulk` di `posters.ts`. Un errore
 *  su una riga non ferma le altre — chi ha incollato venti sagre vuole le
 *  diciannove buone, e sapere qual è quella rimasta fuori. */
export async function createMany(
  drafts: EventDraft[],
  onProgress?: (done: number, total: number) => void
): Promise<CreateManyReport> {
  const report: CreateManyReport = { saved: [], failed: [] }
  for (const [i, draft] of drafts.entries()) {
    onProgress?.(i, drafts.length)
    try {
      report.saved.push(await createEvent(draft))
    } catch (err) {
      report.failed.push({
        index: i,
        title: draft.title,
        error: err instanceof Error ? err.message : 'Errore sconosciuto.',
      })
    }
  }
  onProgress?.(drafts.length, drafts.length)
  return report
}

export async function updateEvent(eventId: string, draft: EventDraft): Promise<CalendarEvent> {
  const res = await call(`/${encodeURIComponent(eventId)}${QUIET}`, {
    method: 'PATCH',
    body: JSON.stringify(toBody(draft)),
  })
  return toCalendarEvent((await res.json()) as GCalEvent)
}

export async function deleteEvent(eventId: string): Promise<void> {
  await call(`/${encodeURIComponent(eventId)}${QUIET}`, { method: 'DELETE' })
}
