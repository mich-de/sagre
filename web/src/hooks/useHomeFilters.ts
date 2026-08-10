import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CalendarViewMode, SortKey, TimeRange } from '../lib/filters'

/* ---------------------------------------------------------------------------
 * I filtri stanno nell'indirizzo, non in uno stato qualunque: così il link si
 * manda a un amico o si mette nei preferiti e riapre la stessa vista, e il
 * tasto indietro del browser torna ai filtri di prima invece di uscire dal
 * sito. L'indirizzo è l'unica verità — lo stato di React non ne tiene copia.
 *
 * Si scrive solo quel che si discosta dai valori normali, altrimenti bastano
 * due clic per avere una barra dell'indirizzo lunga un metro.
 * ------------------------------------------------------------------------- */

const VIEW_KEY = 'sagre.view'

export interface HomeFilters {
  query: string
  categories: string[]
  range: TimeRange
  /** Estremi dell'intervallo su misura, in formato aaaa-mm-gg. */
  from: string
  to: string
  place: string
  sort: SortKey
  view: CalendarViewMode
}

const RANGE_KEYS: TimeRange[] = ['futuri', 'settimana', 'tutti', 'intervallo']
const SORT_KEYS: SortKey[] = ['prossimi', 'recenti', 'alfabetico']
const VIEW_KEYS: CalendarViewMode[] = ['grid', 'list']

function pick<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/** La vista che il browser si ricorda. Sul telefono la griglia è illeggibile,
 *  quindi senza preferenze salvate si parte dall'elenco. */
function preferredView(): CalendarViewMode {
  const saved = localStorage.getItem(VIEW_KEY)
  if (saved === 'grid' || saved === 'list') return saved
  return window.matchMedia('(max-width: 640px)').matches ? 'list' : 'grid'
}

export interface UseHomeFiltersResult {
  filters: HomeFilters
  /** `replace` per quel che cambia a ogni tasto premuto: la ricerca non deve
   *  lasciare trenta tappe nella cronologia. */
  set: (patch: Partial<HomeFilters>, options?: { replace?: boolean }) => void
  clear: () => void
  filtering: boolean
}

export function useHomeFilters(): UseHomeFiltersResult {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<HomeFilters>(
    () => ({
      query: params.get('q') ?? '',
      categories: (params.get('cat') ?? '').split(',').filter(Boolean),
      range: pick(params.get('quando'), RANGE_KEYS, 'futuri'),
      from: params.get('da') ?? '',
      to: params.get('a') ?? '',
      place: params.get('luogo') ?? '',
      sort: pick(params.get('ordine'), SORT_KEYS, 'prossimi'),
      view: pick(params.get('vista'), VIEW_KEYS, preferredView()),
    }),
    [params]
  )

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, filters.view)
  }, [filters.view])

  const set = useCallback<UseHomeFiltersResult['set']>(
    (patch, options) => {
      const next = new URLSearchParams(params)
      const put = (key: string, value: string, fallback = '') => {
        if (!value || value === fallback) next.delete(key)
        else next.set(key, value)
      }

      if (patch.query !== undefined) put('q', patch.query)
      if (patch.categories !== undefined) put('cat', patch.categories.join(','))
      if (patch.place !== undefined) put('luogo', patch.place)
      if (patch.sort !== undefined) put('ordine', patch.sort, 'prossimi')
      if (patch.view !== undefined) put('vista', patch.view)
      if (patch.range !== undefined) {
        put('quando', patch.range, 'futuri')
        /* Uscendo dall'intervallo su misura le due date non servono più, e
           lasciarle vuol dire ritrovarsele addosso al prossimo giro. */
        if (patch.range !== 'intervallo') {
          next.delete('da')
          next.delete('a')
        }
      }
      /* Scegliere una data *è* scegliere l'intervallo su misura: chiedere due
         gesti per una cosa sola è il modo migliore per non farla capire. */
      if (patch.from !== undefined) {
        put('da', patch.from)
        if (patch.from) next.set('quando', 'intervallo')
      }
      if (patch.to !== undefined) {
        put('a', patch.to)
        if (patch.to) next.set('quando', 'intervallo')
      }

      setParams(next, { replace: options?.replace ?? false })
    },
    [params, setParams]
  )

  const clear = useCallback(() => {
    const next = new URLSearchParams()
    /* La vista non è un filtro: azzerare non deve rispedire nella griglia chi
       stava leggendo l'elenco. */
    const view = params.get('vista')
    if (view) next.set('vista', view)
    setParams(next)
  }, [params, setParams])

  const filtering =
    filters.query.trim().length > 0 ||
    filters.categories.length > 0 ||
    filters.range !== 'futuri' ||
    filters.place.length > 0 ||
    filters.sort !== 'prossimi'

  return { filters, set, clear, filtering }
}
