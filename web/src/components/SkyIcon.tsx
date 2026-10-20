import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudRain,
  CloudLightning,
  Snowflake,
} from 'lucide-react'
import { skyOf, type SkyKind } from '../lib/weather'

/* ---------------------------------------------------------------------------
 * Il cielo disegnato. Sta qui e non in `lib/weather.ts` perché un'icona è un
 * componente React, e in `lib/` non entra React: là dentro resta il codice
 * WMO, che è un numero e vale anche senza schermo.
 *
 * Una tabella sola, non una per posto che mostra il tempo: la striscia della
 * scheda e la pastiglia sulla riga di cartellone devono disegnare la stessa
 * nuvola, altrimenti la seconda volta che si aggiunge un codice si aggiunge
 * in un file e si dimentica nell'altro.
 * ------------------------------------------------------------------------- */

const SKY_ICON: Record<SkyKind, typeof Sun> = {
  sereno: Sun,
  nuvole: CloudSun,
  coperto: Cloud,
  nebbia: CloudFog,
  pioggia: CloudRain,
  temporale: CloudLightning,
  neve: Snowflake,
}

/** L'icona del cielo con la sua dicitura per chi legge lo schermo con la voce:
 *  un disegno muto, da solo, non dice niente a nessuno. */
export function SkyIcon({
  code,
  size = 14,
  className,
}: {
  code: number
  size?: number
  className?: string
}) {
  const sky = skyOf(code)
  const Icon = SKY_ICON[sky.kind]
  return (
    <>
      <Icon size={size} className={className} aria-hidden />
      <span className="sr-only">{sky.label}</span>
    </>
  )
}
