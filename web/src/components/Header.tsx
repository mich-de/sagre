import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, Info, ShieldCheck } from 'lucide-react'

const TODAY_LINE = new Date().toLocaleDateString('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function Header() {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  const isAbout = pathname.startsWith('/cosa-e')
  const ref = useRef<HTMLElement | null>(null)

  /* La testata è alta quanto è alta: chi ci si appoggia in `sticky` legge la
     misura vera invece di un numero scritto a mano che sbaglia sul telefono. */
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty('--header-h', `${entry.contentRect.height}px`)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <header ref={ref} className="safe-x sticky top-0 z-40 border-b-2 border-ink bg-paper/95 backdrop-blur-sm">
      {/* Filetto di servizio: data a sinistra, dicitura a destra. */}
      <div className="border-b border-ink/25">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-1 sm:px-6">
          <span className="eyebrow truncate">{TODAY_LINE}</span>
          <span className="eyebrow hidden sm:block">Affisso al muro dal 2026</span>
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="group flex items-baseline gap-2.5">
          <span className="relative flex h-9 w-9 shrink-0 translate-y-1 items-center justify-center border-2 border-ink bg-vermiglio text-paper-hi shadow-[2px_2px_0_var(--color-ink)] transition-transform group-hover:-rotate-3">
            <span className="font-display text-lg font-black leading-none">S</span>
          </span>
          <span className="font-display text-2xl leading-none font-black tracking-tight text-ink sm:text-3xl">
            Eventi <span className="font-normal italic text-vermiglio">e</span> Sagre
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1.5">
          <NavLink
            to="/"
            active={!isAdmin && !isAbout}
            icon={<CalendarDays size={14} />}
            label="Calendario"
          />
          <NavLink to="/cosa-e" active={isAbout} icon={<Info size={14} />} label="Cos’è" />
          <NavLink to="/admin" active={isAdmin} icon={<ShieldCheck size={14} />} label="Admin" />
        </nav>
      </div>

      {/* Ticker: nastro d'inchiostro con le voci ricorrenti della sagra. */}
      <div className="overflow-hidden border-t-2 border-ink bg-ink py-1 text-paper-hi">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1}>
              {['Sagre', 'Feste patronali', 'Mercatini', 'Concerti in piazza', 'Fiere', 'Palii', 'Processioni', 'Street food'].map(
                (word) => (
                  <span key={word} className="flex items-center">
                    <span className="px-4 text-[0.6rem] font-semibold tracking-[0.22em] uppercase">{word}</span>
                    <span className="text-vermiglio">✳</span>
                  </span>
                )
              )}
            </span>
          ))}
        </div>
      </div>
    </header>
  )
}

function NavLink({
  to,
  active,
  icon,
  label,
}: {
  to: string
  active: boolean
  icon: React.ReactNode
  label: string
}) {
  return (
    <Link
      to={to}
      /* Sul telefono la scritta non c'è: senza questo il bottone è un'icona
         muta per chi legge lo schermo con la voce. */
      aria-label={label}
      className={`stamp-btn tap flex items-center gap-1.5 px-3 py-2 text-[0.65rem] font-bold tracking-[0.12em] uppercase ${
        active ? 'bg-ink text-paper-hi' : 'bg-paper-hi text-ink hover:bg-paper-2'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )
}
