export interface EventCategory {
  key: string
  label: string
  color: string
}

/* Colori da tavolozza di stampa: tutti abbastanza scuri da reggere il
   testo chiaro sopra. L'ultima è la categoria di riserva. */
export const CATEGORIES: EventCategory[] = [
  { key: 'sagra', label: 'Sagra', color: '#C8321E' },
  { key: 'musica', label: 'Musica', color: '#6E1F3C' },
  { key: 'mercato', label: 'Mercato', color: '#8A6A0A' },
  { key: 'natale', label: 'Natale', color: '#175B6B' },
  { key: 'sport', label: 'Sport', color: '#41601F' },
  { key: 'spettacolo', label: 'Spettacolo', color: '#7A3B78' },
  { key: 'evento', label: 'Evento', color: '#A8531C' },
]

const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]))
const DEFAULT_CATEGORY = BY_KEY.get('evento') as EventCategory

/* Ordine = priorità di riconoscimento. */
const RULES: Array<{ match: RegExp; key: string }> = [
  { match: /sagra|gastronom|degustazion|cucina|street food/i, key: 'sagra' },
  { match: /concerto|musica|live|dj set|band/i, key: 'musica' },
  { match: /mercat|fiera|expo|artigian/i, key: 'mercato' },
  { match: /natale|presepe|babbo natale|avvento/i, key: 'natale' },
  { match: /sport|torneo|corsa|maratona|gara/i, key: 'sport' },
  { match: /teatro|spettacolo|danza|cinema/i, key: 'spettacolo' },
]

export function categoryByKey(key?: string | null): EventCategory | null {
  return (key && BY_KEY.get(key)) || null
}

/** L'euristica sul titolo sbaglia spesso sui nomi di fantasia: se
 *  l'organizzatore ha scelto a mano una categoria, quella vince. */
export function categorize(title: string, description: string, override?: string | null): EventCategory {
  const forced = categoryByKey(override)
  if (forced) return forced
  const haystack = `${title} ${description}`
  for (const rule of RULES) {
    if (rule.match.test(haystack)) return BY_KEY.get(rule.key) as EventCategory
  }
  return DEFAULT_CATEGORY
}
