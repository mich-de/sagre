import { useCallback, useEffect, useState } from 'react'
import { listExtras, EMPTY_EXTRAS, type EventExtras } from '../lib/posters'

interface UseEventExtrasResult {
  extras: Record<string, EventExtras>
  loading: boolean
  reload: () => void
  /** Mai `undefined`: chi disegna un evento senza scheda usa i valori neutri. */
  extrasOf: (eventId: string) => EventExtras
}

/** Legge in un colpo solo le schede di tutti gli eventi. Se Firestore non
 *  risponde il sito resta in piedi: si perdono le locandine, non il calendario. */
export function useEventExtras(): UseEventExtrasResult {
  const [extras, setExtras] = useState<Record<string, EventExtras>>({})
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listExtras()
      .then((data) => {
        if (!cancelled) setExtras(data)
      })
      .catch(() => {
        if (!cancelled) setExtras({})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  const extrasOf = useCallback(
    (eventId: string) => extras[eventId] ?? { ...EMPTY_EXTRAS, eventId },
    [extras]
  )

  return { extras, loading, reload: () => setReloadKey((k) => k + 1), extrasOf }
}
