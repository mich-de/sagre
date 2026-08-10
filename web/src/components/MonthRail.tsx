import { useEffect, useRef, useState } from 'react'
import { monthAnchorId, shortMonthLabel, type MonthGroup } from '../lib/dates'

interface MonthRailProps {
  months: MonthGroup[]
}

/* ---------------------------------------------------------------------------
 * Indice dei mesi: la costola di un annuario. Un cartellone lungo sei mesi si
 * scorre a vuoto per minuti prima di arrivare a settembre — qui basta un dito.
 * La linguetta accesa segue quel che si sta leggendo, così l'indice dice anche
 * dove si è finiti, non solo dove si può andare.
 * ------------------------------------------------------------------------- */

export function MonthRail({ months }: MonthRailProps) {
  const [active, setActive] = useState(months[0]?.key ?? '')
  const railRef = useRef<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  /* L'altezza vera finisce in `--rail-h`: le testate di mese si incollano
     sotto l'indice, e nessuno sa in anticipo quanto è alto. */
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const write = () => document.documentElement.style.setProperty('--rail-h', `${el.offsetHeight}px`)
    write()
    const observer = new ResizeObserver(write)
    observer.observe(el)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--rail-h')
    }
  }, [])

  /* Quale mese si sta leggendo: l'ultimo la cui testata è già passata sotto
     l'indice. Letto sullo scorrimento vero e non con un IntersectionObserver,
     perché la linea di riferimento si muove con la testata del sito. */
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const line = (railRef.current?.getBoundingClientRect().bottom ?? 0) + 8
      let current = months[0]?.key ?? ''
      for (const month of months) {
        const el = document.getElementById(monthAnchorId(month.key))
        if (el && el.getBoundingClientRect().top <= line) current = month.key
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [months])

  /* La linguetta accesa si porta al centro da sola: su uno schermo stretto
     l'indice è più lungo della riga e il mese corrente finirebbe fuori. */
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || !active) return
    const tab = scroller.querySelector<HTMLElement>(`[data-month="${active}"]`)
    if (!tab) return
    scroller.scrollTo({
      left: tab.offsetLeft - scroller.clientWidth / 2 + tab.offsetWidth / 2,
      behavior: 'smooth',
    })
  }, [active])

  function goTo(key: string) {
    /* `scroll-margin-top` sulla testata fa il conto della testata e
       dell'indice: qui basta chiedere di arrivarci. */
    document.getElementById(monthAnchorId(key))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      ref={railRef}
      className="sticky top-[calc(var(--header-h)+0.25rem)] z-20 -mx-3 mb-4 border-y-2 border-ink bg-paper-hi sm:-mx-5"
    >
      <div
        ref={scrollerRef}
        role="tablist"
        aria-label="Vai al mese"
        className="no-scrollbar flex gap-1.5 overflow-x-auto overscroll-x-contain px-3 py-2 sm:px-5"
      >
        <span className="eyebrow hidden shrink-0 self-center pr-1 sm:block">Mesi</span>
        {months.map((month) => {
          const on = month.key === active
          return (
            <button
              key={month.key}
              data-month={month.key}
              role="tab"
              aria-selected={on}
              onClick={() => goTo(month.key)}
              className={`tap-grow flex shrink-0 items-center gap-1.5 border-2 px-2.5 py-1 text-[0.62rem] font-bold tracking-[0.12em] uppercase transition-colors ${
                on
                  ? 'border-ink bg-ink text-paper-hi'
                  : 'border-ink/25 text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              {shortMonthLabel(month.key)}
              <span className={on ? 'text-paper-hi/70' : 'text-ink-faint'}>{month.events.length}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
