import type { CalendarEvent } from './googleCalendar'
import { placeOf, normalizePlace } from './places'
import { eventStart, eventEndInclusive, isoDay, startOfDay, addDays } from './dates'

/* ---------------------------------------------------------------------------
 * Una sagra si fa in piazza: la domanda che tutti fanno prima di uscire di
 * casa non è "a che ora", è "piove?". Le previsioni arrivano da Open-Meteo,
 * che non chiede chiavi né registrazioni — una in meno da tenere in un `.env`
 * che poi finisce nel repo.
 *
 * Due passaggi, due cache diverse, perché le due cose invecchiano in modo
 * opposto: il paese sta dov'è (coordinate in `localStorage`, per sempre), il
 * tempo cambia (previsioni in memoria, un'ora e si ributtano).
 * ------------------------------------------------------------------------- */

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/** Quanto in là guarda il servizio gratuito. Oltre, non c'è niente da mostrare
 *  e va detto, altrimenti sembra un pezzo di pagina che non ha caricato. */
export const FORECAST_DAYS = 16

const GEO_KEY = 'sagre.geo.'
const FORECAST_TTL_MS = 60 * 60 * 1000

export interface DayWeather {
  /** aaaa-mm-gg, nel fuso di Roma come lo restituisce il servizio. */
  date: string
  code: number
  max: number
  min: number
  /** Probabilità di pioggia in percentuale; `null` se il servizio non la dà. */
  rain: number | null
}

export interface Coords {
  lat: number
  lon: number
}

/* ------------------------------------------------------- codici WMO -- */

export type SkyKind = 'sereno' | 'nuvole' | 'coperto' | 'nebbia' | 'pioggia' | 'temporale' | 'neve'

interface Sky {
  kind: SkyKind
  label: string
}

/* Le voci sono quelle che direbbe uno affacciandosi alla finestra, non il
   bollettino: "coperto" e non "cielo nuvoloso con copertura 8/8". */
const SKY: Array<{ codes: number[]; sky: Sky }> = [
  { codes: [0], sky: { kind: 'sereno', label: 'Sereno' } },
  { codes: [1, 2], sky: { kind: 'nuvole', label: 'Poco nuvoloso' } },
  { codes: [3], sky: { kind: 'coperto', label: 'Coperto' } },
  { codes: [45, 48], sky: { kind: 'nebbia', label: 'Nebbia' } },
  { codes: [51, 53, 55, 56, 57], sky: { kind: 'pioggia', label: 'Pioviggine' } },
  { codes: [61, 63, 66, 80, 81], sky: { kind: 'pioggia', label: 'Pioggia' } },
  { codes: [65, 67, 82], sky: { kind: 'pioggia', label: 'Pioggia forte' } },
  { codes: [71, 73, 75, 77, 85, 86], sky: { kind: 'neve', label: 'Neve' } },
  { codes: [95], sky: { kind: 'temporale', label: 'Temporale' } },
  { codes: [96, 99], sky: { kind: 'temporale', label: 'Temporale con grandine' } },
]

const UNKNOWN_SKY: Sky = { kind: 'nuvole', label: 'Variabile' }

export function skyOf(code: number): Sky {
  return SKY.find((s) => s.codes.includes(code))?.sky ?? UNKNOWN_SKY
}

/** Giornata da ombrello: o il cielo la promette, o la probabilità è alta
 *  abbastanza da rovinare una griglia accesa alle sette. */
export function isWet(day: DayWeather): boolean {
  const kind = skyOf(day.code).kind
  return kind === 'pioggia' || kind === 'temporale' || (day.rain ?? 0) >= 50
}

/* -------------------------------------------------------- il paese -- */

/** Chiavi di ricerca, dalla più promettente alla più generica: prima il paese
 *  ricavato dall'indirizzo, poi il primo pezzo del campo luogo per chi ha
 *  scritto solo "Positano" senza virgole. */
function searchKeys(location: string): string[] {
  const keys: string[] = []
  const place = placeOf(location)
  if (place) keys.push(place)
  const head = location.split(',')[0]?.trim()
  if (head && (!place || normalizePlace(head) !== normalizePlace(place))) keys.push(head)
  return keys
}

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    /* Navigazione anonima o archivio pieno: si rinuncia alla cache, non alle
       previsioni. */
    return null
  }
}

function writeStore(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Vedi sopra. */
  }
}

const geoPending = new Map<string, Promise<Coords | null>>()

/** Coordinate del paese. `null` quando il campo luogo non è un posto che il
 *  servizio conosce — succede con "Oratorio parrocchiale" e simili. */
export async function geocode(location: string): Promise<Coords | null> {
  const keys = searchKeys(location)
  if (keys.length === 0) return null

  const cacheKey = GEO_KEY + normalizePlace(keys[0])
  const cached = readStore(cacheKey)
  if (cached) {
    /* "-" è il segnaposto del posto che non esiste: senza, ogni apertura di
       quella scheda ributta la stessa domanda a cui è già stato risposto no. */
    if (cached === '-') return null
    const [lat, lon] = cached.split(',').map(Number)
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }
  }

  const existing = geoPending.get(cacheKey)
  if (existing) return existing

  const request = (async () => {
    for (const key of keys) {
      const url = `${GEO_URL}?name=${encodeURIComponent(key)}&count=1&language=it&format=json`
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        const data = (await res.json()) as {
          results?: Array<{ latitude: number; longitude: number }>
        }
        const hit = data.results?.[0]
        if (!hit) continue
        const coords = { lat: hit.latitude, lon: hit.longitude }
        writeStore(cacheKey, `${coords.lat},${coords.lon}`)
        return coords
      } catch {
        /* Rete assente: non si scrive niente in cache, così al prossimo giro
           si riprova invece di ricordarsi un fallimento passeggero. */
        return null
      }
    }
    writeStore(cacheKey, '-')
    return null
  })().finally(() => geoPending.delete(cacheKey))

  geoPending.set(cacheKey, request)
  return request
}

/* --------------------------------------------------------- il tempo -- */

interface CachedForecast {
  at: number
  days: DayWeather[]
}

const forecasts = new Map<string, CachedForecast>()
const forecastPending = new Map<string, Promise<DayWeather[]>>()

/** Due decimali bastano: la sagra del paese accanto non merita una chiamata
 *  in più solo perché la piazza è cinquecento metri più a sud. */
function coordKey({ lat, lon }: Coords): string {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`
}

export async function forecast(coords: Coords): Promise<DayWeather[]> {
  const key = coordKey(coords)
  const cached = forecasts.get(key)
  if (cached && Date.now() - cached.at < FORECAST_TTL_MS) return cached.days

  const existing = forecastPending.get(key)
  if (existing) return existing

  const url =
    `${FORECAST_URL}?latitude=${coords.lat}&longitude=${coords.lon}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    `&timezone=Europe%2FRome&forecast_days=${FORECAST_DAYS}`

  const request = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) return []
      const data = (await res.json()) as {
        daily?: {
          time: string[]
          weather_code: number[]
          temperature_2m_max: number[]
          temperature_2m_min: number[]
          precipitation_probability_max: Array<number | null>
        }
      }
      const daily = data.daily
      if (!daily?.time) return []
      const days = daily.time.map((date, i) => ({
        date,
        code: daily.weather_code[i] ?? 0,
        max: Math.round(daily.temperature_2m_max[i] ?? 0),
        min: Math.round(daily.temperature_2m_min[i] ?? 0),
        rain: daily.precipitation_probability_max?.[i] ?? null,
      }))
      forecasts.set(key, { at: Date.now(), days })
      return days
    } catch {
      return []
    }
  })().finally(() => forecastPending.delete(key))

  forecastPending.set(key, request)
  return request
}

/* ------------------------------------------------- finestra dell'evento -- */

/** I giorni della festa che cadono dentro la finestra delle previsioni, da
 *  oggi in avanti: quello che è già passato non interessa più a nessuno. */
export function forecastableDays(event: CalendarEvent, now: Date = new Date()): string[] {
  const today = startOfDay(now)
  const horizon = addDays(today, FORECAST_DAYS - 1)
  const from = startOfDay(eventStart(event))
  const to = startOfDay(eventEndInclusive(event))

  const first = from < today ? today : from
  const last = to > horizon ? horizon : to
  if (last < first) return []

  const days: string[] = []
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(isoDay(d))
  return days
}

/** L'evento c'è ancora ma è più in là di quanto il servizio sappia vedere. */
export function isTooFar(event: CalendarEvent, now: Date = new Date()): boolean {
  return startOfDay(eventStart(event)) > addDays(startOfDay(now), FORECAST_DAYS - 1)
}
