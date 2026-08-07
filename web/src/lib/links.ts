export type LinkKind = 'instagram' | 'facebook' | 'youtube' | 'tiktok' | 'article' | 'web'

export interface EventLink {
  url: string
  label: string
}

/* Ordine importante: i domini più specifici prima, così un articolo ospitato
   su un social resta social e non finisce nel generico "articolo". */
const HOSTS: Array<{ kind: LinkKind; label: string; match: RegExp }> = [
  { kind: 'instagram', label: 'Instagram', match: /(^|\.)instagram\.com$/i },
  { kind: 'facebook', label: 'Facebook', match: /(^|\.)(facebook\.com|fb\.me|fb\.com)$/i },
  { kind: 'youtube', label: 'YouTube', match: /(^|\.)(youtube\.com|youtu\.be)$/i },
  { kind: 'tiktok', label: 'TikTok', match: /(^|\.)tiktok\.com$/i },
]

const ARTICLE_HINT = /\b(news|articol|notizi|cronaca|magazine|blog|press|rassegna)\b/i

function hostOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./i, '')
  } catch {
    return null
  }
}

export function linkKind(url: string): LinkKind {
  const host = hostOf(url)
  if (!host) return 'web'
  const known = HOSTS.find((h) => h.match.test(host))
  if (known) return known.kind
  return ARTICLE_HINT.test(host) || ARTICLE_HINT.test(url) ? 'article' : 'web'
}

/** Etichetta proposta all'organizzatore quando incolla un indirizzo. */
export function suggestLinkLabel(url: string): string {
  const host = hostOf(url)
  if (!host) return ''
  const known = HOSTS.find((h) => h.match.test(host))
  if (known) return known.label
  if (linkKind(url) === 'article') return 'Articolo'
  return host
}

/** Aggiunge https:// a un indirizzo incollato senza schema. */
export function normalizeUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

export function isValidUrl(raw: string): boolean {
  return hostOf(normalizeUrl(raw)) !== null
}
