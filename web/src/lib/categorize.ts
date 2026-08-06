export interface EventCategory {
  label: string
  color: string
}

const RULES: Array<{ match: RegExp; category: EventCategory }> = [
  { match: /sagra|gastronom|degustazion|cucina|street food/i, category: { label: 'Sagra', color: '#FF6B35' } },
  { match: /concerto|musica|live|dj set|band/i, category: { label: 'Musica', color: '#9C4DB8' } },
  { match: /mercat|fiera|expo|artigian/i, category: { label: 'Mercato', color: '#FFD700' } },
  { match: /natale|presepe|babbo natale|avvento/i, category: { label: 'Natale', color: '#2196F3' } },
  { match: /sport|torneo|corsa|maratona|gara/i, category: { label: 'Sport', color: '#4CAF50' } },
  { match: /teatro|spettacolo|danza|cinema/i, category: { label: 'Spettacolo', color: '#BD7FE0' } },
]

const DEFAULT_CATEGORY: EventCategory = { label: 'Evento', color: '#FF8C42' }

export function categorize(title: string, description: string): EventCategory {
  const haystack = `${title} ${description}`
  for (const rule of RULES) {
    if (rule.match.test(haystack)) return rule.category
  }
  return DEFAULT_CATEGORY
}
