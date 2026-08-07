export interface EventCategory {
  label: string
  color: string
}

/* Colori da tavolozza di stampa: tutti abbastanza scuri da reggere il
   testo su carta chiara. Ordine = priorità di riconoscimento. */
const RULES: Array<{ match: RegExp; category: EventCategory }> = [
  { match: /sagra|gastronom|degustazion|cucina|street food/i, category: { label: 'Sagra', color: '#C8321E' } },
  { match: /concerto|musica|live|dj set|band/i, category: { label: 'Musica', color: '#6E1F3C' } },
  { match: /mercat|fiera|expo|artigian/i, category: { label: 'Mercato', color: '#8A6A0A' } },
  { match: /natale|presepe|babbo natale|avvento/i, category: { label: 'Natale', color: '#175B6B' } },
  { match: /sport|torneo|corsa|maratona|gara/i, category: { label: 'Sport', color: '#41601F' } },
  { match: /teatro|spettacolo|danza|cinema/i, category: { label: 'Spettacolo', color: '#7A3B78' } },
]

const DEFAULT_CATEGORY: EventCategory = { label: 'Evento', color: '#A8531C' }

export function categorize(title: string, description: string): EventCategory {
  const haystack = `${title} ${description}`
  for (const rule of RULES) {
    if (rule.match.test(haystack)) return rule.category
  }
  return DEFAULT_CATEGORY
}
