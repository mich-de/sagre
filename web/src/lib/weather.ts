import type { CalendarEvent } from './googleCalendar'
import { placeSegments, normalizePlace } from './places'
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

/* `v2` e non più `sagre.geo.`: la prima versione ha salvato "per sempre" anche
   gli sbagli. Chiedeva "Gragnano (NA)", che non trova nessuno, e "NA", che
   senza filtro di nazione risponde Ban Na in Thailandia — un pallino sulla
   mappa a novemila chilometri da dove si mangia. Correggere il codice non
   basta: senza cambiare il prefisso, i telefoni che hanno già aperto il
   cartellone si ricordano l'errore e non richiedono più niente. */
const GEO_KEY = 'sagre.geo.v2.'
const GEO_KEY_OLD = 'sagre.geo.'
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

/* Le coordinate sbagliate della prima versione vanno buttate, non solo
   ignorate: restare in archivio a occupare posto è il meno, il problema è che
   un domani qualcuno rimetta il vecchio prefisso e le ritrovi. Una volta per
   sessione, alla prima domanda. */
let sweptOldGeo = false
function sweepOldGeo(): void {
  if (sweptOldGeo) return
  sweptOldGeo = true
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      /* `GEO_KEY` comincia per `GEO_KEY_OLD`: senza la seconda condizione la
         pulizia si porterebbe via anche le coordinate nuove. */
      if (key?.startsWith(GEO_KEY_OLD) && !key.startsWith(GEO_KEY)) doomed.push(key)
    }
    for (const key of doomed) localStorage.removeItem(key)
  } catch {
    /* Navigazione anonima: non c'è niente da pulire. */
  }
}

const geoPending = new Map<string, Promise<Coords | null>>()

/** Coordinate del paese. `null` quando il campo luogo non è un posto che il
 *  servizio conosce — succede con "Oratorio parrocchiale" e simili. */
export async function geocode(location: string): Promise<Coords | null> {
  sweepOldGeo()
  /* Le chiavi da provare in fila: il paese, e se quello non lo conosce nessuno
     i pezzi dell'indirizzo che gli stanno intorno. */
  const keys = placeSegments(location)
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
      /* `countryCode=IT`: senza, il servizio cerca in tutto il mondo e a una
         domanda storta risponde con l'altro emisfero invece di dire "non lo
         so". Un cartellone di sagre non ha niente fuori dall'Italia, e un
         "non lo so" si vede subito, un pallino in Thailandia no. */
      const url =
        `${GEO_URL}?name=${encodeURIComponent(key)}` +
        '&count=1&language=it&format=json&countryCode=IT'
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

/* --------------------------------------------------- il tempo di adesso -- */

/** Il bollettino di un posto in questo momento. */
export interface NowWeather {
  place: string
  /** Ora della misura, `aaaa-mm-ggThh:mm` nel fuso di Roma. Non è l'ora in cui
   *  si è chiesta: il servizio aggiorna a scatti di un quarto d'ora, e dire
   *  "adesso" quando il dato è di venti minuti fa è una bugia piccola ma è una
   *  bugia. */
  time: string
  temp: number
  /** Quella che si sente addosso: ad agosto in costiera i due numeri si
   *  discostano di quattro o cinque gradi, e chi deve stare in piazza fino a
   *  mezzanotte guarda questo. */
  feels: number
  humidity: number
  /** Millimetri caduti nell'ultimo quarto d'ora. */
  rain: number
  code: number
  wind: number
  gust: number
  /** Da dove tira, in gradi. */
  windFrom: number
}

/** I posti del bollettino, dal golfo alla costiera.
 *
 *  Sono coordinate scritte a mano, e va bene così: la geografia della penisola
 *  non cambia, a differenza di una tabella frazione→comune che invecchia a ogni
 *  sagra nuova. Sette e non uno perché in mezzo ci sono i monti Lattari: a
 *  Sorrento c'è il sole e a Tramonti piove, e un numero solo per tutti direbbe
 *  la cosa giusta a metà della gente.
 *
 *  **Uno per cella della griglia.** Il modello gira su maglie da qualche
 *  chilometro, e due paesi vicini ricevono lo stesso identico numero: Vico
 *  Equense e Sorrento cadono nella stessa casella, e due schede gemelle sullo
 *  schermo si leggono come un guasto, non come una misura. Vico Equense — che di
 *  sagre ne ha tante — resta fuori per questo, non per dimenticanza. Chi tocca
 *  questo elenco lo verifichi: il servizio restituisce le coordinate agganciate
 *  alla griglia, e basta guardare se si ripetono. */
export const NOW_SPOTS: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Castellammare', lat: 40.695, lon: 14.483 },
  { name: 'Sorrento', lat: 40.626, lon: 14.375 },
  { name: 'Massa Lubrense', lat: 40.609, lon: 14.343 },
  { name: 'Positano', lat: 40.628, lon: 14.485 },
  { name: 'Amalfi', lat: 40.634, lon: 14.603 },
  { name: 'Tramonti', lat: 40.696, lon: 14.632 },
  { name: 'Ischia', lat: 40.744, lon: 13.947 },
]

/** I venti come li chiama chi va per mare, non solo la sigla: su una costa
 *  dove si pesca da sempre, «Scirocco» dice più di «da sud-est» — e dice anche
 *  che porta afa e mare mosso, che a una sagra in spiaggia serve saperlo. */
const WINDS = [
  { sigla: 'N', name: 'Tramontana' },
  { sigla: 'NE', name: 'Grecale' },
  { sigla: 'E', name: 'Levante' },
  { sigla: 'SE', name: 'Scirocco' },
  { sigla: 'S', name: 'Ostro' },
  { sigla: 'SO', name: 'Libeccio' },
  { sigla: 'O', name: 'Ponente' },
  { sigla: 'NO', name: 'Maestrale' },
]

export function windFrom(deg: number): { sigla: string; name: string } {
  const normal = (((deg % 360) + 360) % 360) / 45
  return WINDS[Math.round(normal) % 8]
}

/** Sopra questa soglia le raffiche portano via i gazebo e fanno chiudere il
 *  palco: è il numero per cui un organizzatore prende il telefono. */
export const GUSTY_KMH = 50

/** Il tempo di adesso invecchia in fretta, ma non tanto quanto sembra: il
 *  servizio ricalcola ogni quarto d'ora, e chiederglielo più spesso è solo
 *  traffico che restituisce lo stesso numero. */
const NOW_TTL_MS = 10 * 60 * 1000

const NOW_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
].join(',')

let nowCache: { at: number; spots: NowWeather[] } | null = null
let nowPending: Promise<NowWeather[]> | null = null

interface NowResponse {
  /** Le coordinate **agganciate alla griglia**, che non sono quelle chieste: è
   *  la casella vera del modello, e serve a scoprire due posti che ricevono la
   *  stessa misura. */
  latitude?: number
  longitude?: number
  current?: {
    time: string
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    precipitation: number
    weather_code: number
    wind_speed_10m: number
    wind_direction_10m: number
    wind_gusts_10m: number
  }
}

/** Il bollettino di tutti i posti, in **una** richiesta: Open-Meteo accetta le
 *  coordinate in fila e risponde con un elenco nello stesso ordine. Sette
 *  chiamate separate sarebbero sette volte il traffico per lo stesso dato.
 *
 *  Elenco vuoto se il servizio non risponde: una sezione che non compare è
 *  meglio di una sezione con dentro dei buchi. */
export async function nowAround(force = false): Promise<NowWeather[]> {
  if (!force && nowCache && Date.now() - nowCache.at < NOW_TTL_MS) return nowCache.spots
  if (nowPending) return nowPending

  const url =
    `${FORECAST_URL}?latitude=${NOW_SPOTS.map((s) => s.lat).join(',')}` +
    `&longitude=${NOW_SPOTS.map((s) => s.lon).join(',')}` +
    `&current=${NOW_FIELDS}&timezone=Europe%2FRome`

  nowPending = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) return []
      const data = (await res.json()) as NowResponse[] | NowResponse
      /* Con una coordinata sola il servizio risponde con l'oggetto nudo invece
         dell'elenco: qui sono sempre sette, ma la giornata in cui `NOW_SPOTS`
         si riduce a uno non deve essere la giornata in cui la sezione sparisce
         senza che nessuno capisca perché. */
      const list = Array.isArray(data) ? data : [data]

      const spots: NowWeather[] = []
      /* Una casella una scheda: se due posti dell'elenco finiscono nella stessa
         maglia del modello, il secondo si perde. Perdere una scheda è meno
         grave che mostrarne due identiche, che chi legge chiama un guasto — e
         `NOW_SPOTS` è scelto perché non succeda, questa è la rete sotto. */
      const cells = new Set<string>()
      list.forEach((entry, i) => {
        const c = entry.current
        const spot = NOW_SPOTS[i]
        if (!c || !spot) return
        const cell = `${entry.latitude},${entry.longitude}`
        if (cells.has(cell)) return
        cells.add(cell)
        spots.push({
          place: spot.name,
          time: c.time,
          temp: Math.round(c.temperature_2m),
          feels: Math.round(c.apparent_temperature),
          humidity: Math.round(c.relative_humidity_2m),
          rain: c.precipitation ?? 0,
          code: c.weather_code ?? 0,
          wind: Math.round(c.wind_speed_10m),
          gust: Math.round(c.wind_gusts_10m),
          windFrom: c.wind_direction_10m ?? 0,
        })
      })

      if (spots.length > 0) nowCache = { at: Date.now(), spots }
      return spots
    } catch {
      return []
    }
  })().finally(() => {
    nowPending = null
  })

  return nowPending
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
