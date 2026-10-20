import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

/** Timbro di ritorno in cima. Un cartellone di sei mesi è lungo qualche
 *  metro di pollice: senza, per rifare una ricerca si risale a mano. */
export function BackToTop() {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      setShown(window.scrollY > 700)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  if (!shown) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Torna in cima"
      /* Lo scalino di casa scorre col fondo dello schermo: su iPhone la barra
         di sistema si mangerebbe il pulsante. */
      className="stamp-btn no-print fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex animate-ink-rise items-center gap-1.5 bg-senape px-3 py-3 text-[0.6rem] font-bold tracking-[0.14em] uppercase text-ink sm:px-3.5 sm:py-2.5"
    >
      <ArrowUp size={15} />
      <span className="hidden sm:inline">In cima</span>
    </button>
  )
}
