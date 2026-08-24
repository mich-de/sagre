import type { ReactNode } from 'react'

/** Pastiglia acceso/spento per «cosa portarsi dietro»: la usano la copia da un
 *  altro evento e la ripetizione dell'anno prossimo, che fanno la stessa
 *  domanda con le stesse voci. */
export function PartToggle({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`tap-grow flex items-center border-2 px-2.5 py-1.5 text-[0.6rem] font-bold tracking-[0.1em] uppercase transition-colors ${
        on ? 'border-ink bg-ink text-paper-hi' : 'border-ink/25 text-ink-soft hover:border-ink hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
