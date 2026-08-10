import { CalendarX, RotateCcw } from 'lucide-react'
import type { HomeFilters } from '../hooks/useHomeFilters'

interface NoResultsProps {
  filters: HomeFilters
  onChange: (patch: Partial<HomeFilters>) => void
  onClear: () => void
}

/* ---------------------------------------------------------------------------
 * Cartello di vicolo cieco. Un "nessun risultato" secco lascia il lettore a
 * indovinare quale dei cinque filtri gli sta nascondendo la sagra: qui ogni
 * filtro attivo diventa un pulsante che lo toglie, in ordine di quanto è
 * probabile che sia lui il colpevole.
 * ------------------------------------------------------------------------- */

export function NoResults({ filters, onChange, onClear }: NoResultsProps) {
  const { query, categories, range, place, view } = filters

  const ways: Array<{ label: string; hint: string; apply: () => void }> = []

  /* La finestra temporale è la trappola più comune: di gennaio, con "prossimi"
     acceso, mezzo cartellone dell'anno prima sparisce senza dirlo. */
  if (view === 'list' && range !== 'tutti') {
    ways.push({
      label: 'Guarda tutto il cartellone',
      hint: 'anche le feste già passate',
      apply: () => onChange({ range: 'tutti' }),
    })
  }
  if (place) {
    ways.push({
      label: `Togli “${place}”`,
      hint: 'cerca in tutti i paesi',
      apply: () => onChange({ place: '' }),
    })
  }
  if (categories.length > 0) {
    ways.push({
      label: categories.length === 1 ? 'Togli il colore scelto' : 'Togli i colori scelti',
      hint: 'tutte le categorie',
      apply: () => onChange({ categories: [] }),
    })
  }
  if (query.trim()) {
    ways.push({
      label: `Cancella “${query.trim()}”`,
      hint: 'svuota la ricerca',
      apply: () => onChange({ query: '' }),
    })
  }

  return (
    <div className="flex flex-col items-center gap-4 px-2 py-12 text-center sm:py-16">
      <CalendarX size={28} className="text-ink-faint" />
      <div>
        <p className="font-display text-2xl leading-tight font-black text-ink">Cartellone vuoto</p>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
          {ways.length > 0
            ? 'Nessuna festa passa questi filtri. Prova ad allargare la ricerca.'
            : 'Il calendario non ha ancora appuntamenti da mostrare.'}
        </p>
      </div>

      {ways.length > 0 && (
        <div className="mt-1 flex w-full max-w-sm flex-col gap-2">
          {ways.map((way) => (
            <button
              key={way.label}
              onClick={way.apply}
              className="stamp-btn tap-grow flex items-center justify-between gap-3 bg-paper-hi px-3.5 py-2.5 text-left"
            >
              <span className="min-w-0 truncate text-[0.7rem] font-bold tracking-[0.1em] uppercase text-ink">
                {way.label}
              </span>
              <span className="shrink-0 text-[0.62rem] text-ink-faint">{way.hint}</span>
            </button>
          ))}

          <button
            onClick={onClear}
            className="tap tap-grow mt-1 flex items-center justify-center gap-1.5 text-[0.65rem] font-bold tracking-[0.14em] uppercase text-vermiglio hover:underline"
          >
            <RotateCcw size={12} />
            Azzera tutti i filtri
          </button>
        </div>
      )}
    </div>
  )
}
