import { useMemo, useState } from 'react'
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

export function CalendarView({ events, onSelectEvent }: CalendarViewProps) {
  const [isMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches)

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
          extendedProps: { sourceId: e.id },
        }
      }),
    [events]
  )

  function handleEventClick(arg: EventClickArg) {
    const found = events.find((e) => e.id === arg.event.id)
    if (found) onSelectEvent(found)
  }

  function renderEventContent(arg: EventContentArg) {
    return (
      <div className="truncate px-1 text-xs font-medium">
        {!arg.event.allDay && (
          <span className="mr-1 opacity-80">{arg.timeText}</span>
        )}
        {arg.event.title}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--color-outline-dark)] bg-[var(--color-surface-dark)] p-2 shadow-xl sm:p-4">
      <FullCalendar
        plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
        initialView={isMobile ? 'listMonth' : 'dayGridMonth'}
        locale={itLocale}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: isMobile ? 'listMonth,dayGridMonth' : 'dayGridMonth,listMonth',
        }}
        height="auto"
        events={fcEvents}
        eventClick={handleEventClick}
        eventContent={renderEventContent}
        dayMaxEvents={3}
        firstDay={1}
      />
    </div>
  )
}
