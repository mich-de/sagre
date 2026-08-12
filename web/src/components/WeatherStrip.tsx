import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudRain,
  CloudLightning,
  Snowflake,
  Umbrella,
  Droplets,
} from 'lucide-react'
import type { CalendarEvent } from '../lib/googleCalendar'
import { useWeather } from '../hooks/useWeather'
import { isSameDay, parseEventDate } from '../lib/dates'
import { isWet, skyOf, type DayWeather, type SkyKind } from '../lib/weather'

/* ---------------------------------------------------------------------------
 * "Che si fa se piove" è la prima domanda che si fa a un organizzatore, e
 * l'unica a cui il calendario non sapeva rispondere. Qui il tempo sta accanto
 * alla data, non in un'altra scheda del telefono: una fila di giorni, uno per
 * ogni sera di festa, e una riga sola quando l'acqua è probabile davvero.
 * ------------------------------------------------------------------------- */

const ICON: Record<SkyKind, typeof Sun> = {
  sereno: Sun,
  nuvole: CloudSun,
  coperto: Cloud,
  nebbia: CloudFog,
  pioggia: CloudRain,
  temporale: CloudLightning,
  neve: Snowflake,
}

/** Sotto questa soglia la percentuale è rumore: dirla a chi legge vuol dire
 *  solo mettergli un dubbio addosso per niente. */
const RAIN_WORTH_SAYING = 20

export function WeatherStrip({ event }: { event: CalendarEvent }) {
  const { state, days } = useWeather(event)

  if (state === 'none') return null

  if (state === 'far') {
    return (
      <p className="text-[0.65rem] tracking-[0.06em] text-ink-faint">
        Per il meteo è ancora presto: compare due settimane prima della festa.
      </p>
    )
  }

  if (state === 'loading') {
    return (
      <div>
        <p className="eyebrow">Che tempo farà</p>
        <div className="mt-2 flex gap-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-[4.5rem] w-20 animate-pulse border-2 border-ink/20 bg-paper-2" />
          ))}
        </div>
      </div>
    )
  }

  const wet = days.filter(isWet)

  return (
    <div>
      <p className="eyebrow">Che tempo farà</p>

      {/* Una fila che scorre: le sagre lunghe arrivano a otto o dieci giorni e
          non devono spingere la scheda in larghezza. */}
      <div className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((day) => (
          <DayBox key={day.date} day={day} />
        ))}
      </div>

      {wet.length > 0 && (
        <p className="mt-2 flex items-start gap-2 border-l-4 border-vermiglio bg-paper-2 py-2 pr-3 pl-2.5 text-xs leading-relaxed text-ink">
          <Umbrella size={14} className="mt-px shrink-0 text-vermiglio" />
          <span>
            {wet.length === days.length
              ? 'Acqua su tutti i giorni di festa: conviene l’ombrello, e una telefonata prima di partire.'
              : `Acqua prevista ${wet.map((d) => dayLabel(d.date).toLowerCase()).join(', ')}: conviene l’ombrello.`}
          </span>
        </p>
      )}

      <p className="mt-2 text-[0.6rem] tracking-[0.06em] text-ink-faint">
        Previsioni Open-Meteo per il paese, non per la piazza.
      </p>
    </div>
  )
}

function DayBox({ day }: { day: DayWeather }) {
  const sky = skyOf(day.code)
  const Icon = ICON[sky.kind]
  const rain = day.rain ?? 0
  const wet = isWet(day)

  return (
    <div
      className={`flex w-20 shrink-0 flex-col items-center gap-1 border-2 px-1.5 py-2 ${
        wet ? 'border-vermiglio bg-paper-hi' : 'border-ink/25 bg-paper-2'
      }`}
      title={sky.label}
    >
      <span className="text-[0.58rem] font-bold tracking-[0.12em] text-ink-soft uppercase">
        {dayLabel(day.date)}
      </span>
      <Icon size={22} className={wet ? 'text-vermiglio' : 'text-ink'} aria-hidden />
      <span className="sr-only">{sky.label}</span>
      <span className="font-display text-base leading-none font-black text-ink">
        {day.max}°
        <span className="ml-1 font-body text-[0.65rem] font-semibold text-ink-faint">{day.min}°</span>
      </span>
      {rain >= RAIN_WORTH_SAYING && (
        <span className="flex items-center gap-0.5 text-[0.58rem] font-bold text-ottanio">
          <Droplets size={9} />
          {rain}%
        </span>
      )}
    </div>
  )
}

/** "Oggi", "Dom 17": il giorno della settimana basta a orientarsi, e per la
 *  sera stessa il nome del giorno è un giro di parole. */
function dayLabel(date: string): string {
  const d = parseEventDate(date)
  if (isSameDay(d, new Date())) return 'Oggi'
  const weekday = d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '')
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d.getDate()}`
}
