import { useCallback, useEffect, useState } from 'react'
import { nowAround, type NowWeather } from '../lib/weather'

export type NowState = 'loading' | 'ready' | 'none'

/* Il tempo di adesso è l'unica cosa del cartellone che scade da sola mentre la
   pagina sta aperta: un foglio appeso al bar lo si guarda una volta, questo lo
   si tiene aperto sul telefono mentre si decide se uscire. Quindi si rinfresca
   da sé, e il bottone c'è per chi non si fida. */
const REFRESH_MS = 10 * 60 * 1000

export interface UseNowWeatherResult {
  state: NowState
  spots: NowWeather[]
  reload: () => void
}

export function useNowWeather(): UseNowWeatherResult {
  const [state, setState] = useState<NowState>('loading')
  const [spots, setSpots] = useState<NowWeather[]>([])
  /* Cambiare questo numero è il modo di dire "richiedi": la richiesta vera sta
     in un effetto solo, così non ci sono due strade per arrivare allo stesso
     `fetch` che poi si scordano una dell'altra. */
  const [asked, setAsked] = useState(0)

  const reload = useCallback(() => setAsked((n) => n + 1), [])

  useEffect(() => {
    let aborted = false

    const ask = (force: boolean) => {
      nowAround(force)
        .then((fresh) => {
          if (aborted) return
          /* Se il servizio non risponde si tiene quel che c'era: un numero di
             dieci minuti fa è più utile di un buco, e la sezione dice comunque
             a che ora è stato misurato. */
          if (fresh.length > 0) {
            setSpots(fresh)
            setState('ready')
          } else {
            setState((old) => (old === 'ready' ? 'ready' : 'none'))
          }
        })
        .catch(() => {
          if (!aborted) setState((old) => (old === 'ready' ? 'ready' : 'none'))
        })
    }

    ask(asked > 0)
    const timer = window.setInterval(() => ask(true), REFRESH_MS)

    return () => {
      aborted = true
      window.clearInterval(timer)
    }
  }, [asked])

  return { state, spots, reload }
}
