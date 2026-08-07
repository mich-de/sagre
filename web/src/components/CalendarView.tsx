import { useEffect, useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, EventContentArg } from '@fullcalendar/core'
import itLocale from '@fullcalendar/core/locales/it'
import type { CalendarEvent } from '../lib/googleCalendar'
import { categorize } from '../lib/categorize'

interface CalendarViewProps {
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
}

const MOBILE_QUERY = '(max-width: 640px)'

export function CalendarView({ events, onSelectEvent }: CalendarViewProps) {
  /* La griglia mensile è illeggibile sotto i 640px, quindi lì si parte
     dall'elenco. Il breakpoint va inseguito anche dopo il primo render:
     ruotando il telefono, altrimenti, si resta sulla vista sbagliata. */
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const fcEvents = useMemo(
    () =>
      events.map((e) => {
        const category = categorize(e.title, e.description)
        return {
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          allDay: e.allDay,
          backgroundColor: category.color,
          borderColor: category.color,
          textColor: '#FBF6EA',
          extendedProps: { sourceId: e.id },
        }
      }),
    [events]
  )

  function handleEventClick(arg: EventClickArg) {
    const found = events.find((e) => e.id === arg.event.id)
    if (found) onSelectEvent(found)
  }

  /* Le sagre lunghe attraversano più righe della griglia: le frecce dicono
     da che parte il blocco continua, così una festa di quattro giorni non
     sembra quattro feste diverse. */
  function renderEventContent(arg: EventContentArg) {
    const continuesBefore = !arg.isStart
    const continuesAfter = !arg.isEnd
    return (
      <div className="flex items-center gap-1 px-1.5 py-0.5 text-[0.68rem] leading-tight font-semibold">
        {continuesBefore && <span aria-hidden>‹</span>}
        {arg.isStart && !arg.event.allDay && arg.timeText && (
          <span className="shrink-0 tabular-nums opacity-75">{arg.timeText}</span>
        )}
        <span className="truncate">{arg.event.title}</span>
        {continuesAfter && <span className="ml-auto shrink-0" aria-hidden>›</span>}
      </div>
    )
  }

  return (
    <div className="ink-box overflow-hidden">
      {/* Bandierine lungo il bordo superiore del cartellone. */}
      <div className="bunting" aria-hidden />
      <div className="p-3 sm:p-5">
        <FullCalendar
          key={isMobile ? 'mobile' : 'desktop'}
          plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
          initialView={isMobile ? 'listMonth' : 'dayGridMonth'}
          locale={itLocale}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: isMobile ? 'listMonth,dayGridMonth' : 'dayGridMonth,listMonth',
          }}
          buttonText={{ today: 'Oggi', month: 'Griglia', list: 'Elenco' }}
          height="auto"
          events={fcEvents}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
          dayMaxEvents={isMobile ? 3 : 4}
          eventOrder="start,-duration,allDay,title"
          firstDay={1}
          noEventsText="Nessun appuntamento in cartellone questo mese."
        />
      </div>
    </div>
  )
}
