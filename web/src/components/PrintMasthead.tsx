import { RANGES } from '../lib/filters'
import { CATEGORIES } from '../lib/categorize'
import type { HomeFilters } from '../hooks/useHomeFilters'

/* ---------------------------------------------------------------------------
 * Testata che esiste solo sulla carta. Sullo schermo la fa il componente
 * `Header`, che però è appiccicato in alto e pieno di pulsanti: roba da dito,
 * non da foglio. Qui si scrive quel che serve a chi il foglio se lo trova
 * appeso alla bacheca del bar — che cos'è, di quando è, e dove trovarlo per
 * intero, visto che una stampa non si aggiorna da sola.
 * ------------------------------------------------------------------------- */

const PRINTED_ON = new Date().toLocaleDateString('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** Che cosa si sta guardando, detto a parole: senza barra dei filtri sotto gli
 *  occhi, un foglio con dentro tre sagre su quaranta sarebbe un mistero. */
function describe(filters: HomeFilters, shown: number, total: number): string {
  const bits: string[] = []
  if (filters.place) bits.push(filters.place)
  if (filters.categories.length > 0) {
    const labels = CATEGORIES.filter((c) => filters.categories.includes(c.key)).map((c) => c.label)
    if (labels.length > 0) bits.push(labels.join(', '))
  }
  if (filters.query.trim()) bits.push(`«${filters.query.trim()}»`)
  if (filters.view === 'list' && filters.range !== 'futuri') {
    const range = RANGES.find((r) => r.key === filters.range)
    if (range) {
      bits.push(
        filters.range === 'intervallo' && (filters.from || filters.to)
          ? `dal ${filters.from || '…'} al ${filters.to || '…'}`
          : range.label.toLowerCase()
      )
    }
  }

  const count = shown === total ? `${total} appuntamenti` : `${shown} appuntamenti su ${total}`
  return bits.length > 0 ? `${count} · ${bits.join(' · ')}` : count
}

export function PrintMasthead({
  filters,
  shown,
  total,
}: {
  filters: HomeFilters
  shown: number
  total: number
}) {
  return (
    <div className="hidden print:block">
      <h1 className="font-display text-4xl leading-none font-black tracking-[-0.02em]">
        Eventi <span className="font-normal italic">&amp;</span> Sagre
      </h1>
      <p className="mt-1 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
        {describe(filters, shown, total)}
      </p>
      <div className="mt-2 mb-4 border-t-[3px] border-b border-black" />
      <p className="mb-5 text-[0.65rem]">
        Stampato il {PRINTED_ON} · Il cartellone aggiornato è su{' '}
        <strong>{window.location.host}</strong>
      </p>
    </div>
  )
}
