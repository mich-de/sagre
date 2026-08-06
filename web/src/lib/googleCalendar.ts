export interface CalendarEvent {
  id: string
  title: string
  description: string
  location: string
  start: string
  end: string
  allDay: boolean
  htmlLink: string
}

interface GCalDateTime {
  date?: string
  dateTime?: string
  timeZone?: string
}

interface GCalEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  start: GCalDateTime
  end: GCalDateTime
  htmlLink: string
  status: string
}

interface GCalEventsResponse {
  items: GCalEvent[]
  nextPageToken?: string
}

const API_KEY = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY as string | undefined
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID as string | undefined

function toCalendarEvent(raw: GCalEvent): CalendarEvent {
  const allDay = !!raw.start.date
  return {
    id: raw.id,
    title: raw.summary ?? '(senza titolo)',
    description: raw.description ?? '',
    location: raw.location ?? '',
    start: (raw.start.dateTime ?? raw.start.date) as string,
    end: (raw.end.dateTime ?? raw.end.date) as string,
    allDay,
    htmlLink: raw.htmlLink,
  }
}

export async function fetchUpcomingEvents(): Promise<CalendarEvent[]> {
  if (!API_KEY || !CALENDAR_ID) {
    throw new Error(
      'Calendario non configurato: mancano VITE_GOOGLE_CALENDAR_API_KEY / VITE_GOOGLE_CALENDAR_ID.'
    )
  }

  const events: CalendarEvent[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`
    )
    url.searchParams.set('key', API_KEY)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('maxResults', '250')
    // 6 months back so recently-past events still show in list view, plenty forward
    const timeMin = new Date()
    timeMin.setMonth(timeMin.getMonth() - 6)
    url.searchParams.set('timeMin', timeMin.toISOString())
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetch(url.toString())
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Google Calendar API error ${res.status}: ${body}`)
    }
    const data: GCalEventsResponse = await res.json()
    for (const item of data.items) {
      if (item.status === 'cancelled') continue
      events.push(toCalendarEvent(item))
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  return events
}

export function googleCalendarAddUrl(event: CalendarEvent): string {
  const fmt = (iso: string, allDay: boolean) => {
    const d = new Date(iso)
    if (allDay) {
      return d.toISOString().slice(0, 10).replace(/-/g, '')
    }
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description,
    dates: `${fmt(event.start, event.allDay)}/${fmt(event.end, event.allDay)}`,
  })
  if (event.location) params.set('location', event.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
