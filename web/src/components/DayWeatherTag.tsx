import { Umbrella } from 'lucide-react'
import type { CalendarEvent } from '../lib/googleCalendar'
import { useWeather } from '../hooks/useWeather'
import { SkyIcon } from './SkyIcon'
import { isWet } from '../lib/weather'

/* ---------------------------------------------------------------------------
 * La stessa domanda della striscia — "piove?" — ma in tre caratteri, per stare
 * sulla riga del cartellone accanto all'ora e al luogo. Chi guarda il pannello
 * di oggi sta decidendo se uscire adesso: aprire la scheda per sapere se
 * portarsi l'ombrello è un passaggio di troppo.
 *
 * Tutto in `span`: la riga di cartellone è un `<button>`, e un `<div>` dentro
 * un bottone è HTML che il browser rimonta a modo suo.
 * ------------------------------------------------------------------------- */

export function DayWeatherTag({ event, day }: { event: CalendarEvent; day: string }) {
  const { state, days } = useWeather(event)

  /* Niente scheletro che pulsa: qui c'è spazio per tre caratteri in mezzo a una
     riga di testo, e una macchia che lampeggia si nota più del dato. Compare
     quando c'è, e nel frattempo la riga sta come stava. */
  if (state !== 'ready') return null

  const forecast = days.find((d) => d.date === day)
  if (!forecast) return null

  const wet = isWet(forecast)

  return (
    <span
      className={`flex items-center gap-1 font-semibold whitespace-nowrap tabular-nums ${
        wet ? 'text-vermiglio' : 'text-ink-soft'
      }`}
    >
      <SkyIcon code={forecast.code} size={12} className="shrink-0" />
      {forecast.max}°
      {wet && <Umbrella size={11} className="shrink-0" />}
    </span>
  )
}
