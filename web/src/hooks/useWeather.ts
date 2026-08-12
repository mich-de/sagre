import { useEffect, useState } from 'react'
import type { CalendarEvent } from '../lib/googleCalendar'
import { isOver } from '../lib/dates'
import { forecast, forecastableDays, geocode, isTooFar, type DayWeather } from '../lib/weather'

/* Stati distinti perché la scheda deve dire cose diverse: "sto guardando",
   "ecco il tempo", "è ancora presto", "di questo posto non so niente".
   Un solo `loading` con l'elenco vuoto li confonderebbe tutti in un buco. */
export type WeatherState = 'loading' | 'ready' | 'far' | 'none'

export interface UseWeatherResult {
  state: WeatherState
  days: DayWeather[]
}

/** Previsioni per i giorni di festa. Niente chiamate per le sagre finite,
 *  senza luogo o troppo lontane: sono la maggior parte del cartellone, e ogni
 *  scheda aperta sarebbe una domanda a un servizio che risponde comunque no. */
export function useWeather(event: CalendarEvent): UseWeatherResult {
  const location = event.location

  /* Tutto quello che serve all'effetto, ridotto a due valori semplici. Il
     cartellone ricrea gli eventi da capo a ogni "Aggiorna" — stessi dati,
     oggetti nuovi — e un effetto che guardasse l'oggetto ripartirebbe ogni
     volta. Guardando i giorni, invece, riparte solo se i giorni cambiano
     davvero: per esempio perché l'organizzatore ha spostato la sagra. */
  const skip: WeatherState | null =
    !location.trim() || isOver(event) ? 'none' : isTooFar(event) ? 'far' : null
  const key = skip ? '' : forecastableDays(event).join(',')

  const [state, setState] = useState<WeatherState>(skip ?? 'loading')
  const [days, setDays] = useState<DayWeather[]>([])

  useEffect(() => {
    setDays([])

    if (skip || !key) {
      setState(skip ?? 'none')
      return
    }

    let aborted = false
    setState('loading')

    const wanted = key.split(',')
    geocode(location)
      .then((coords) => (coords ? forecast(coords) : []))
      .then((all) => {
        if (aborted) return
        const mine = all.filter((d) => wanted.includes(d.date))
        setDays(mine)
        setState(mine.length > 0 ? 'ready' : 'none')
      })
      .catch(() => {
        if (!aborted) setState('none')
      })

    return () => {
      aborted = true
    }
  }, [location, skip, key])

  return { state, days }
}
