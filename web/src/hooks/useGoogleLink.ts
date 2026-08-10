import { useCallback, useState, useSyncExternalStore } from 'react'
import { calendarWriteEnabled, connect, disconnect, isLinked, subscribe } from '../lib/googleAuth'

export interface GoogleLink {
  /** C'è un ID client: senza, i comandi di scrittura non vanno mostrati. */
  available: boolean
  linked: boolean
  busy: boolean
  error: string | null
  link: () => Promise<void>
  unlink: () => void
}

/** Stato del collegamento a Google, condiviso da chiunque lo mostri: il
 *  permesso è uno solo per tutta la pagina. */
export function useGoogleLink(): GoogleLink {
  const linked = useSyncExternalStore(subscribe, isLinked)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const link = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await connect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Collegamento non riuscito.')
    } finally {
      setBusy(false)
    }
  }, [])

  const unlink = useCallback(() => {
    setError(null)
    disconnect()
  }, [])

  return { available: calendarWriteEnabled, linked, busy, error, link, unlink }
}
