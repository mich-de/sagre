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
  /** Gli altri paesi che ricadono nella **stessa casella** del modello, e che
   *  quindi hanno per forza questi stessi numeri. Vanno scritti sulla scheda:
   *  chi cerca Sant'Agnello deve trovare Sant'Agnello, e una misura che copre
   *  tre paesi lo dice invece di far sparire due nomi. Quasi sempre vuoto. */
  also: string[]
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

/** I paesi del bollettino: la penisola comune per comune, poi la costiera.
 *
 *  Sono coordinate scritte a mano, e va bene così: la geografia della penisola
 *  non cambia, a differenza di una tabella frazione→comune che invecchia a ogni
 *  sagra nuova. Non uno solo perché in mezzo ci sono i monti Lattari: a Sorrento
 *  c'è il sole e a Tramonti piove, e un numero per tutti direbbe la cosa giusta
 *  a metà della gente.
 *
 *  **L'ordine non è casuale.** Se due paesi cadono nella stessa casella del
 *  modello vince il primo, e gli altri gli finiscono scritti sotto come `also`:
 *  quindi il nome che la gente conosce deve venire prima. Misurato il 25 agosto
 *  2026 su `NOW_MODEL`, l'unica casella condivisa è Sorrento con Sant'Agnello e
 *  Piano di Sorrento — ed è per questo che Sorrento apre l'elenco invece di
 *  stare al suo posto geografico in mezzo agli altri.
 *
 *  Chi aggiunge un paese lo verifichi come si è fatto qui: la risposta contiene
 *  le coordinate **agganciate alla griglia**, e basta guardare quali si
 *  ripetono. Aggiungerne uno non costa una richiesta in più — vanno tutti nella
 *  stessa — ma costa una scheda sullo schermo. */
export const NOW_SPOTS: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Sorrento', lat: 40.6263, lon: 14.3757 },
  { name: 'Sant’Agnello', lat: 40.6294, lon: 14.3956 },
  { name: 'Piano di Sorrento', lat: 40.6394, lon: 14.4064 },
  { name: 'Meta', lat: 40.6425, lon: 14.4181 },
  { name: 'Vico Equense', lat: 40.6614, lon: 14.4247 },
  { name: 'Castellammare di Stabia', lat: 40.6947, lon: 14.4811 },
  { name: 'Gragnano', lat: 40.6889, lon: 14.5183 },
  { name: 'Sant’Agata sui Due Golfi', lat: 40.6153, lon: 14.3706 },
  { name: 'Massa Lubrense', lat: 40.6094, lon: 14.3428 },
  { name: 'Positano', lat: 40.6281, lon: 14.485 },
  { name: 'Praiano', lat: 40.611, lon: 14.5289 },
  { name: 'Amalfi', lat: 40.634, lon: 14.6027 },
  { name: 'Tramonti', lat: 40.6961, lon: 14.6322 },
  { name: 'Ischia', lat: 40.7439, lon: 13.947 },
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

/** Il modello a maglia fine, e la ragione per cui non si usa il predefinito.
 *
 *  Misurato il 25 agosto 2026 sugli stessi ventidue paesi, chiedendo le
 *  coordinate agganciate alla griglia e poi **confrontando i numeri**, non solo
 *  contando le coordinate:
 *
 *  - `best_match` (predefinito): 22 paesi → **10 caselle**. Una sola si mangia
 *    Vico Equense, Seiano, Meta, Piano di Sorrento, Sant'Agnello, Sorrento e
 *    Sant'Agata. E mette insieme Gragnano e Positano, che stanno ai due lati
 *    della montagna. Troppo larga per una penisola stretta così.
 *  - `meteofrance_seamless`: 20 coordinate su 20 tutte diverse, e sembra la
 *    risposta — ma sono le coordinate **chieste**, restituite tali e quali:
 *    delle dodici letture solo nove erano distinte, con otto paesi a vento
 *    identico. Un modello che interpola invece di agganciare è peggio del
 *    predefinito, perché il controllo dei doppioni qui sotto smette di
 *    funzionare senza dire niente. Da non riprovare.
 *  - `dmi_seamless` (scelto): **12 letture su 12 davvero distinte**, tutti i
 *    campi presenti, nodi di griglia veri da un paio di chilometri. E si vede
 *    che è fisica e non rumore: Positano riparata nella sua cala segnava 4 km/h
 *    di vento mentre Gragnano, dietro i monti, ne segnava 24.
 *
 *  Vale solo per il bollettino di adesso. Le previsioni dei giorni (`forecast`)
 *  restano sul predefinito: là servono sette giorni, e i modelli ad area
 *  limitata arrivano molto meno lontano. */
const NOW_MODEL = 'dmi_seamless'

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

function nowUrl(model: string | null): string {
  return (
    `${FORECAST_URL}?latitude=${NOW_SPOTS.map((s) => s.lat).join(',')}` +
    `&longitude=${NOW_SPOTS.map((s) => s.lon).join(',')}` +
    `&current=${NOW_FIELDS}&timezone=Europe%2FRome` +
    (model ? `&models=${model}` : '')
  )
}

/** Una scheda per casella del modello, coi paesi che quella casella copre.
 *
 *  Qui sta il punto delicato di tutta la sezione. Il modello misura su una
 *  griglia, e paesi vicini possono ricadere nella stessa maglia: prima il
 *  secondo veniva **scartato**, perché due schede coi numeri identici si
 *  leggono come un guasto. Solo che così Sant'Agnello e Piano di Sorrento non
 *  comparivano affatto, e chi ci abita non trovava il suo paese — che è un
 *  difetto peggiore di quello che si voleva evitare.
 *
 *  La misura resta una, ma dice quali paesi copre. Niente numeri finti per far
 *  quadrare i nomi, e nessun nome sparito per far quadrare i numeri. */
function groupByCell(list: NowResponse[]): NowWeather[] {
  const byCell = new Map<string, NowWeather>()
  list.forEach((entry, i) => {
    const c = entry.current
    const spot = NOW_SPOTS[i]
    if (!c || !spot || c.temperature_2m == null) return

    const cell = `${entry.latitude},${entry.longitude}`
    const already = byCell.get(cell)
    if (already) {
      already.also.push(spot.name)
      return
    }
    byCell.set(cell, {
      place: spot.name,
      also: [],
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
  return [...byCell.values()]
}

async function askNow(model: string | null): Promise<NowWeather[]> {
  const res = await fetch(nowUrl(model))
  if (!res.ok) return []
  const data = (await res.json()) as NowResponse[] | NowResponse
  /* Con una coordinata sola il servizio risponde con l'oggetto nudo invece
     dell'elenco: oggi sono quattordici, ma la giornata in cui `NOW_SPOTS` si
     riduce a uno non deve essere la giornata in cui la sezione sparisce senza
     che nessuno capisca perché. */
  return groupByCell(Array.isArray(data) ? data : [data])
}

/** Il bollettino di tutti i paesi, in **una** richiesta: Open-Meteo accetta le
 *  coordinate in fila e risponde con un elenco nello stesso ordine. Quattordici
 *  chiamate separate sarebbero quattordici volte il traffico per lo stesso dato.
 *
 *  Due tentativi, non uno: `NOW_MODEL` è un modello nazionale ad area limitata,
 *  e legare l'intera sezione a un solo fornitore vorrebbe dire che il giorno che
 *  è fuori servizio la sezione svanisce. Se non torna niente si richiede senza
 *  modello — la maglia è più larga, i paesi si raggruppano di più, ma i numeri
 *  ci sono. Un bollettino grossolano batte un buco.
 *
 *  Elenco vuoto solo se falliscono tutti e due: una sezione che non compare è
 *  meglio di una sezione con dentro dei buchi. */
export async function nowAround(force = false): Promise<NowWeather[]> {
  if (!force && nowCache && Date.now() - nowCache.at < NOW_TTL_MS) return nowCache.spots
  if (nowPending) return nowPending

  nowPending = (async () => {
    for (const model of [NOW_MODEL, null]) {
      try {
        const spots = await askNow(model)
        if (spots.length > 0) {
          nowCache = { at: Date.now(), spots }
          return spots
        }
      } catch {
        /* Rete caduta o risposta illeggibile: si prova il ripiego, e se casca
           anche quello si torna con l'elenco vuoto. */
      }
    }
    return []
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
