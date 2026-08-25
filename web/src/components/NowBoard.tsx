import { Droplets, Navigation, RefreshCw, Umbrella, Wind } from 'lucide-react'
import { useNowWeather } from '../hooks/useNowWeather'
import { SkyIcon } from './SkyIcon'
import { GUSTY_KMH, skyOf, windFrom, type NowWeather } from '../lib/weather'

/* ---------------------------------------------------------------------------
 * Il resto del cartellone parla di quel che succederà; questa sezione parla di
 * adesso. È la domanda di chi ha la macchina in cortile e sta decidendo se
 * scendere in piazza stasera: quanto fa, quanto tira, se piove.
 *
 * La penisola comune per comune, e non un posto solo, perché in mezzo ci sono i
 * monti Lattari: a Sorrento può esserci il sole e a Tramonti l'acqua nello
 * stesso quarto d'ora. Una misura per tutti direbbe la cosa giusta a metà della
 * gente — e chi abita a Meta o a Sant'Agnello, se il suo paese non c'è, non ha
 * modo di sapere quale delle schede riguarda lui.
 *
 * Tutta la sezione è `no-print`: su un foglio appeso al muro il tempo di adesso
 * è la prima cosa che diventa falsa, ed è falsa entro un'ora.
 * ------------------------------------------------------------------------- */

export function NowBoard() {
  const { state, spots, reload } = useNowWeather()

  /* Niente riquadro vuoto: se il servizio non risponde la sezione non c'è, e la
     pagina è quella di prima invece di essere quella di prima con un buco. */
  if (state === 'none') return null

  if (state === 'loading') {
    return (
      <section className="no-print mb-8">
        <Masthead />
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {/* Otto e non quattro: le schede vere sono una dozzina, e uno
              scheletro molto più corto di quel che arriva fa saltare la pagina
              sotto le mani nel momento in cui i numeri compaiono. */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[7.5rem] animate-pulse border-2 border-ink/20 bg-paper-2" />
          ))}
        </div>
      </section>
    )
  }

  /* L'ora è quella della misura, non quella dell'orologio: il servizio
     ricalcola a scatti di un quarto d'ora, e scrivere "adesso" su un dato di
     venti minuti fa è una bugia piccola ma è una bugia. */
  const measured = spots[0]?.time.slice(11, 16)
  const grouped = spots.some((s) => s.also.length > 0)

  return (
    <section style={{ animationDelay: '30ms' }} className="no-print mb-8 animate-ink-rise">
      <Masthead measured={measured} onReload={reload} />

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {spots.map((spot) => (
          <SpotCard key={spot.place} spot={spot} />
        ))}
      </div>

      <p className="mt-2 text-[0.6rem] leading-relaxed tracking-[0.06em] text-ink-faint">
        Rilevazioni Open-Meteo su una griglia di un paio di chilometri: è il tempo del paese, non
        quello della piazza. Si aggiorna da sé ogni dieci minuti.
        {/* Detto solo quando succede: spiegare un raggruppamento che non c'è
            fa venire il dubbio che ci sia. */}
        {grouped &&
          ' Dove due paesi cadono nella stessa maglia la misura è una, e la scheda li nomina tutti invece di farne sparire uno.'}
      </p>
    </section>
  )
}

function Masthead({ measured, onReload }: { measured?: string; onReload?: () => void }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b-2 border-ink pb-1.5">
      <div className="min-w-0">
        <p className="eyebrow">In questo momento</p>
        <h2 className="font-display text-xl leading-none font-black text-ink sm:text-2xl">
          Che tempo fa <span className="font-normal italic text-vermiglio">adesso</span>
        </h2>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {measured && <span className="eyebrow whitespace-nowrap">Ore {measured}</span>}
        {onReload && (
          <button
            onClick={onReload}
            aria-label="Richiedi il tempo di adesso"
            title="Richiedi il tempo di adesso"
            className="tap group border-2 border-ink bg-paper-hi p-1.5 text-ink transition-colors hover:bg-paper-2"
          >
            <RefreshCw size={12} className="transition-transform group-hover:rotate-180" />
          </button>
        )}
      </div>
    </div>
  )
}

function SpotCard({ spot }: { spot: NowWeather }) {
  const sky = skyOf(spot.code)
  const wind = windFrom(spot.windFrom)
  const gusty = spot.gust >= GUSTY_KMH
  const raining = spot.rain > 0

  return (
    <div
      className={`ink-box-sm flex min-w-0 flex-col gap-1.5 p-2.5 ${
        raining || gusty ? 'border-vermiglio' : ''
      }`}
    >
      {/* Il nome va a capo invece di finire nei tre puntini: qui trovare il
          proprio paese è tutto il punto della sezione, e «Castellammare di
          S…» lo si trova male. */}
      <div className="min-w-0">
        <p className="font-display text-sm leading-tight font-black text-ink">{spot.place}</p>
        {/* I paesi che stanno nella stessa maglia del modello. Prima venivano
            scartati e non comparivano affatto; scritti qui, la misura è una
            sola e si sa per chi vale. */}
        {spot.also.length > 0 && (
          <p className="mt-0.5 text-[0.55rem] leading-tight tracking-[0.04em] text-ink-faint">
            anche {spot.also.join(', ')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-b border-ink/15 pb-1.5">
        <SkyIcon code={spot.code} size={18} className={raining ? 'text-vermiglio' : 'text-ink'} />
        <span className="truncate text-[0.62rem] font-semibold tracking-[0.04em] text-ink-soft">
          {sky.label}
        </span>
      </div>

      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl leading-none font-black text-ink tabular-nums">
          {spot.temp}°
        </span>
        {/* La percepita si dice solo quando si discosta: ad agosto in costiera
            sono quattro o cinque gradi, e allora conta più della misura; a
            marzo sono zero, e ripeterla è rumore. */}
        {Math.abs(spot.feels - spot.temp) >= 2 && (
          <span className="text-[0.62rem] leading-tight font-semibold text-ink-soft">
            percepiti {spot.feels}°
          </span>
        )}
      </p>

      <p className="flex items-center gap-1 text-[0.62rem] text-ink-soft">
        <Wind size={11} className="shrink-0" />
        {/* Il nome che gli dà chi va per mare, non solo la sigla: su questa
            costa «Scirocco» dice anche che porta afa e mare mosso. */}
        <span className="truncate">
          <span className="font-semibold">{wind.name}</span>{' '}
          <span className="text-ink-faint">{wind.sigla}</span>
        </span>
        <span className="ml-auto shrink-0 font-semibold tabular-nums">{spot.wind}</span>
        {/* L'unità una volta per riga, non una per numero: le raffiche qui sotto
            sono negli stessi km/h e ripeterlo riempie la cella per niente. */}
        <span className="shrink-0 text-[0.55rem] text-ink-faint">km/h</span>
      </p>

      {/* La freccia indica dove va il vento, non da dove viene: `Navigation`
          punta a nord da sola, e un vento «da sud» soffia verso nord. */}
      <p className="flex items-center gap-1 text-[0.62rem]">
        <Navigation
          size={10}
          className={`shrink-0 ${gusty ? 'text-vermiglio' : 'text-ink-faint'}`}
          style={{ transform: `rotate(${spot.windFrom + 180}deg)` }}
          aria-hidden
        />
        <span className={gusty ? 'font-semibold text-vermiglio' : 'text-ink-faint'}>
          Raffiche {spot.gust}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-0.5 text-ottanio">
          <Droplets size={9} />
          <span className="font-semibold tabular-nums">{spot.humidity}%</span>
        </span>
      </p>

      {raining && (
        <p className="flex items-center gap-1 border-t border-vermiglio/40 pt-1.5 text-[0.62rem] font-semibold text-vermiglio">
          <Umbrella size={11} className="shrink-0" />
          Piove, {spot.rain} mm
        </p>
      )}

      {gusty && !raining && (
        <p className="border-t border-vermiglio/40 pt-1.5 text-[0.62rem] font-semibold text-vermiglio">
          Vento forte: attenzione ai gazebo.
        </p>
      )}
    </div>
  )
}
