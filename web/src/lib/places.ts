import type { CalendarEvent } from './googleCalendar'

/* ---------------------------------------------------------------------------
 * Il luogo su Google Calendar è testo libero: a volte è l'indirizzo completo
 * copiato da Maps ("Piazza Tasso, 80067 Sorrento NA, Italia"), a volte solo il
 * nome della piazza ("Sant'Agata sui Due Golfi"). Per filtrare serve il paese,
 * che è l'unica parte con cui abbia senso una domanda come "tutto quello che
 * succede a Positano".
 * ------------------------------------------------------------------------- */

/** "Italia" in coda non dice niente a nessuno. */
const COUNTRY = /^(italia|italy|it)$/i
/** "80067 Sorrento NA" — CAP davanti, sigla della provincia in fondo. */
const CAP_TOWN = /^\d{5}\s+(.+?)(?:\s+[A-Z]{2})?$/
/** La parentesi in coda è un segmento come gli altri: o la sigla della
 *  provincia — "Gragnano (NA)" — o il comune di cui la frazione fa parte,
 *  "Torca (Massa Lubrense)". Trattarla da virgola fa anche finire "Moiano
 *  (Vico Equense)" e "Moiano, Vico Equense" nello stesso paese, invece di due
 *  pallini a pochi metri l'uno dall'altro. */
const PARENS = /[()]/g
/** La sigla della provincia da sola: "Sorrento, NA, Italia", "Maiori (Sa)".
 *  Non è un paese, e chiesta a un geocoder diventa un posto a caso dall'altra
 *  parte del mondo — "NA", senza filtro di nazione, risponde Ban Na in
 *  Thailandia. Restano fuori i due comuni italiani di due lettere, Ne e Re:
 *  non sono da queste parti, e la sigla è mille volte più probabile. */
const SIGLA = /^[a-z]{2}$/i
/** Un segmento senza lettere è un numero civico, non un paese. */
const HAS_LETTERS = /\p{L}/u
/** Segni diacritici, da togliere prima di confrontare due nomi di paese. */
const MARKS = /\p{M}/gu

/** I pezzi utili del campo luogo, **dal più promettente al meno**: si legge da
 *  destra, perché l'ultimo segmento di un indirizzo è il comune, e si buttano
 *  la nazione, le sigle di provincia e i numeri civici.
 *
 *  Il primo è il paese. Gli altri servono a chi può riprovare: le previsioni,
 *  che di un indirizzo sconosciuto tentano il pezzo successivo — "Gete,
 *  Tramonti (SA), Costiera Amalfitana" non ha il comune in fondo, ma ce l'ha
 *  in mezzo. */
export function placeSegments(location: string): string[] {
  const parts = location
    .replace(PARENS, ',')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !COUNTRY.test(s) && !SIGLA.test(s))

  const found: string[] = []
  for (let i = parts.length - 1; i >= 0; i--) {
    const withCap = CAP_TOWN.exec(parts[i])
    const candidate = (withCap ? withCap[1] : parts[i]).trim()
    if (HAS_LETTERS.test(candidate)) found.push(candidate)
  }
  return found
}

/** Il paese, ricavato dal campo luogo. `null` se non se ne cava niente. */
export function placeOf(location: string): string | null {
  return placeSegments(location)[0] ?? null
}

/** Chiave di confronto: niente accenti, niente maiuscole, niente doppi spazi. */
export function normalizePlace(value: string): string {
  return value.normalize('NFD').replace(MARKS, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export interface PlaceGroup {
  /** Il nome come l'ha scritto chi ha compilato il calendario, la prima volta
   *  che compare: è quello che si legge sulla mappa e nei filtri. */
  name: string
  /** La chiave di confronto, per chi deve ritrovare il gruppo. */
  key: string
  events: CalendarEvent[]
}

/** Le sagre raccolte paese per paese, in ordine alfabetico. Chi non ha un paese
 *  riconoscibile nel campo luogo resta fuori: sulla mappa non si saprebbe dove
 *  metterlo, e nel filtro non si saprebbe come chiamarlo. */
export function groupByPlace(events: CalendarEvent[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>()
  for (const event of events) {
    const place = placeOf(event.location)
    if (!place) continue
    const key = normalizePlace(place)
    const group = groups.get(key)
    if (group) group.events.push(event)
    else groups.set(key, { name: place, key, events: [event] })
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'))
}

/** I paesi presenti in cartellone, in ordine alfabetico e senza doppioni. */
export function collectPlaces(events: CalendarEvent[]): string[] {
  return groupByPlace(events).map((g) => g.name)
}

export function inPlace(event: CalendarEvent, place: string): boolean {
  if (!place) return true
  const key = normalizePlace(place)
  const own = placeOf(event.location)
  if (own && normalizePlace(own) === key) return true
  /* Vale anche l'indirizzo intero: chi scrive "Spiaggia Grande, Positano" e
     chi scrive solo "Positano" parlano dello stesso paese. */
  return normalizePlace(event.location).includes(key)
}
