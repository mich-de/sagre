import { useEffect, useState } from 'react'

/** Segue una media query dal codice, non solo dal CSS: serve quando è il
 *  comportamento a cambiare — quanti eventi far stare in una cella, se il
 *  tocco è il dito o il mouse — e non solo l'aspetto. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    onChange()
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export const useIsPhone = () => useMediaQuery('(max-width: 640px)')
export const useIsTouch = () => useMediaQuery('(pointer: coarse)')
