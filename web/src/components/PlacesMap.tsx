import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Filter, CircleOff } from 'lucide-react'
import { EventCard } from './EventCard'
import { groupByPlace, normalizePlace, placeOf, type PlaceGroup } from '../lib/places'
import { geocode, type Coords } from '../lib/weather'
import type { CalendarEvent } from '../lib/googleCalendar'
import type { EventExtras } from '../lib/posters'

/* ---------------------------------------------------------------------------
 * "Cosa c'è vicino a me" è una domanda geografica, e a una domanda geografica
 * un elenco alfabetico risponde male: chi sta a Praiano non sa se Furore è
 * dietro l'angolo o dall'altra parte della costa.
 *
 * Le coordinate arrivano da `geocode()`, lo stesso servizio che già serve il
 * meteo: nessuna chiave, nessun elenco di paesi da tenere aggiornato a mano, e
 * la cache in `localStorage` è condivisa — chi ha già guardato il tempo di una
 * sagra ha già le coordinate del suo paese.
 *
 * Dentro i popup di Leaflet non entra React: sono nodi del DOM che Leaflet
 * crea e distrugge quando vuole. Quindi il tocco su un pallino non apre un
 * popup, accende il paese e l'elenco delle sue sagre compare qui sotto — dove
 * si può riusare `EventCard` come nel resto del cartellone.
 * ------------------------------------------------------------------------- */

/** I paesi stanno dove sono: la cache vive nel modulo e non nello stato, così
 *  cambiando filtri i pallini non spariscono per ricomparire uno alla volta. */
const known = new Map<string, Coords | null>()

/** Centro dell'Italia, per il mezzo secondo che passa prima di sapere dove
 *  sono i paesi veri: meglio di un rettangolo grigio. */
const ITALY: L.LatLngTuple = [42.0, 12.6]

/** Il pallino cresce come l'area, non come il raggio: cinque sagre non devono
 *  fare un pallino cinque volte più grande, o coprono il paese accanto. */
function radiusOf(count: number): number {
  return 6 + Math.sqrt(count) * 3
}

interface Pin extends PlaceGroup {
  coords: Coords
}

interface PlacesMapProps {
  events: CalendarEvent[]
  extrasOf: (eventId: string) => EventExtras
  onSelectEvent: (event: CalendarEvent) => void
  /** Filtra tutto il cartellone su un paese, mappa compresa. */
  onPickPlace: (place: string) => void
  /** Il paese già scelto nei filtri: la mappa parte con quello acceso. */
  place: string
}

export function PlacesMap({ events, extrasOf, onSelectEvent, onPickPlace, place }: PlacesMapProps) {
  const groups = useMemo(() => groupByPlace(events), [events])

  /* Gli appuntamenti che nel campo luogo non hanno un paese riconoscibile. Non
     si nascondono in silenzio: si dice quanti sono, altrimenti la mappa sembra
     completa e non lo è. */
  const homeless = useMemo(() => events.filter((e) => !placeOf(e.location)).length, [events])

  /* Si parte da quel che il modulo sa già: cambiando filtri o vista i pallini
     restano dove sono invece di sparire e ricomparire uno alla volta. */
  const [found, setFound] = useState<Map<string, Coords | null>>(() => new Map(known))
  const [active, setActive] = useState(() => (place ? normalizePlace(place) : ''))

  /* Il paese scelto nella barra dei filtri accende il suo pallino: chi filtra
     su Positano dalla tendina si aspetta di trovarlo già aperto qui sotto. */
  useEffect(() => {
    if (place) setActive(normalizePlace(place))
  }, [place])

  /* Un paese alla volta: sono richieste a un servizio gratuito, e con la cache
     dal secondo giro in poi il giro è istantaneo comunque. */
  useEffect(() => {
    let alive = true
    void (async () => {
      for (const group of groups) {
        if (known.has(group.key)) continue
        const coords = await geocode(group.name)
        if (!alive) return
        known.set(group.key, coords)
        setFound(new Map(known))
      }
    })()
    return () => {
      alive = false
    }
  }, [groups])

  const pins = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, coords: found.get(g.key) ?? null }))
        .filter((g): g is Pin => g.coords !== null),
    [groups, found]
  )

  /* Chi non si trova sulla carta: succede con "Oratorio parrocchiale" o con un
     paese scritto male. Va detto per nome, così chi tiene il calendario sa cosa
     correggere. */
  const lost = useMemo(
    () => groups.filter((g) => found.get(g.key) === null).map((g) => g.name),
    [groups, found]
  )

  const holder = useRef<HTMLDivElement | null>(null)
  const map = useRef<L.Map | null>(null)
  const pinLayer = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!holder.current || map.current) return

    const m = L.map(holder.current, {
      /* La rotella scorre la pagina, non ingrandisce la mappa: una mappa in
         mezzo a un elenco lungo che si mangia lo scorrimento è una trappola.
         Per ingrandire ci sono i due pulsanti e le due dita. */
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView(ITALY, 6)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      /* L'attribuzione non è un vezzo: la licenza ODbL la richiede, e va
         lasciata visibile. */
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)

    pinLayer.current = L.layerGroup().addTo(m)
    map.current = m

    return () => {
      m.remove()
      map.current = null
      pinLayer.current = null
    }
  }, [])

  /* I pallini si ridisegnano tutti: sono dieci o venti, e tenere in vita un
     indice di quali sono cambiati costerebbe più di quel che risparmia. */
  useEffect(() => {
    const layer = pinLayer.current
    if (!layer) return
    layer.clearLayers()

    for (const pin of pins) {
      const on = pin.key === active
      const marker = L.circleMarker([pin.coords.lat, pin.coords.lon], {
        radius: radiusOf(pin.events.length),
        /* Colore e spessore stanno nel foglio di stile insieme agli altri
           colori di stampa: quello che Leaflet scrive negli attributi lo
           sovrascrive la regola CSS. */
        className: on ? 'sagra-pin is-active' : 'sagra-pin',
      })
      marker.bindTooltip(
        `${pin.name} · ${pin.events.length} ${pin.events.length === 1 ? 'appuntamento' : 'appuntamenti'}`,
        { direction: 'top', className: 'sagra-tip' }
      )
      marker.on('click', () => setActive(pin.key))
      marker.addTo(layer)
    }
  }, [pins, active])

  /* Gli angoli da inquadrare, non i pallini: dipendendo da questi l'inquadratura
     si rifà quando cambiano i paesi e non quando se ne accende uno — una mappa
     che salta a ogni tocco è illeggibile. */
  const corners = useMemo(
    () => pins.map((p) => [p.coords.lat, p.coords.lon] as L.LatLngTuple),
    [pins]
  )

  useEffect(() => {
    const m = map.current
    if (!m) return
    /* La mappa nasce dentro un riquadro che il browser ha appena disegnato:
       senza questa riga Leaflet resta convinto di essere alta zero. */
    m.invalidateSize()
    if (corners.length === 0) return
    /* `maxZoom`: con un paese solo l'inquadratura perfetta è il tetto della
       chiesa, e da lì non si capisce più dove si è. */
    m.fitBounds(L.latLngBounds(corners), { padding: [30, 30], maxZoom: 12 })
  }, [corners])

  const chosen = pins.find((p) => p.key === active) ?? null
  const waiting = pins.length === 0 && lost.length < groups.length

  return (
    <div className="ink-box no-print p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="eyebrow">
          {pins.length} {pins.length === 1 ? 'paese' : 'paesi'} in cartellone
        </p>
        <p className="text-[0.62rem] text-ink-faint">
          {chosen ? 'Tocca un altro pallino per cambiare paese.' : 'Tocca un pallino per vedere le sagre.'}
        </p>
      </div>

      {/* `relative` e altezza in `vh` con un tetto: la mappa deve stare in uno
          schermo di telefono senza diventare un francobollo sul portatile. */}
      <div className="relative border-2 border-ink">
        <div ref={holder} className="h-[58vh] max-h-[34rem] min-h-[18rem] w-full bg-paper-2" />
        {waiting && (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit border-2 border-ink bg-paper-hi px-2.5 py-1 text-[0.62rem] font-bold tracking-[0.1em] uppercase text-ink-soft">
            Sto cercando i paesi…
          </p>
        )}
      </div>

      {groups.length === 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-faint">
          <CircleOff size={14} />
          Nessuno di questi appuntamenti dice in che paese si svolge.
        </p>
      )}

      {(lost.length > 0 || homeless > 0) && (
        <p className="mt-3 text-[0.65rem] leading-relaxed text-ink-faint">
          {homeless > 0 && (
            <>
              {homeless} {homeless === 1 ? 'appuntamento non dice' : 'appuntamenti non dicono'} in che paese
              {homeless === 1 ? ' si svolge' : ' si svolgono'}.{' '}
            </>
          )}
          {lost.length > 0 && <>Non trovati sulla carta: {lost.join(', ')}.</>}
        </p>
      )}

      {/* -------------------------------------------- le sagre del paese -- */}
      {chosen && (
        <div className="mt-4 border-t-2 border-ink/20 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h3 className="flex min-w-0 items-center gap-2 font-display text-xl font-black text-ink">
              <MapPin size={16} className="shrink-0 text-vermiglio" />
              <span className="truncate">{chosen.name}</span>
            </h3>
            {/* Un paese acceso sulla mappa è una domanda a metà: chi lo tocca
                spesso vuole tutto il cartellone di quel paese, date comprese. */}
            {normalizePlace(place) !== chosen.key && (
              <button
                onClick={() => onPickPlace(chosen.name)}
                className="stamp-btn tap tap-grow flex items-center gap-2 bg-paper-hi px-3 py-2 text-[0.6rem] font-bold tracking-[0.12em] uppercase text-ink"
              >
                <Filter size={12} />
                Solo {chosen.name}
              </button>
            )}
          </div>

          <ul className="mt-3 space-y-2">
            {chosen.events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} extras={extrasOf(event.id)} onSelect={onSelectEvent} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[0.6rem] text-ink-faint">
        Le posizioni sono quelle del paese, non della piazza: per arrivare in fondo apri la scheda della
        sagra.
      </p>
    </div>
  )
}
